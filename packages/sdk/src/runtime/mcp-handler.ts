/**
 * Core MCP JSON-RPC protocol handler with two-tool split.
 *
 * Registers exactly two tools:
 * - `kit` — text-only progressive discovery & CRUD
 *     kit()              → list available actions
 *     kit(cmd)           → describe an action's parameters
 *     kit(cmd, params)   → run an action
 * - `kit_view` — embedded resource rendering
 *     kit_view()         → list available views
 *     kit_view(view)     → execute loader, return shell HTML + pre-loaded data
 *
 * Shared by `kitstack dev` and `serve()`. Stateless per-request after
 * initialization.
 *
 * T-0024, T-0025
 */

import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type {
  KitDefinition,
  KitContext,
  KitToolResult,
  KitToolContentBlock,
  ToolDefinition,
  AuthzRequirement,
} from "../types";
import { zodToJsonSchema } from "./zod-to-json-schema";
import { generateShell } from "../shell-template";

// ---------------------------------------------------------------------------
// JSON-RPC types
// ---------------------------------------------------------------------------

/**
 * A JSON-RPC 2.0 request object as received from the MCP transport layer.
 *
 * Requests with an `id` expect a {@link JsonRpcResponse} in return.
 * Requests without an `id` (or where `id` is `null`) are **notifications** and
 * `handleRequest` returns `null` for them.
 *
 * @example
 * ```typescript
 * // Initialize handshake — the first message from any MCP client
 * const initRequest: JsonRpcRequest = {
 *   jsonrpc: "2.0",
 *   id: 1,
 *   method: "initialize",
 * };
 * const response = await handler.handleRequest(initRequest);
 * ```
 *
 * @example
 * ```typescript
 * // Call the kit tool with progressive discovery
 * const listActions: JsonRpcRequest = {
 *   jsonrpc: "2.0",
 *   id: 2,
 *   method: "tools/call",
 *   params: { name: "kit", arguments: {} },
 * };
 * const res = await handler.handleRequest(listActions);
 * ```
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * A JSON-RPC 2.0 response object returned by {@link McpHandler.handleRequest}.
 *
 * Exactly one of `result` or `error` will be set. The `id` matches the
 * originating {@link JsonRpcRequest}. For notifications, `handleRequest`
 * returns `null` instead of a response.
 *
 * @example
 * ```typescript
 * // Successful response from tools/list
 * const res = await handler.handleRequest({
 *   jsonrpc: "2.0", id: 1, method: "tools/list",
 * });
 * // res.result.tools → [{ name: "kit", ... }, { name: "kit_view", ... }]
 * ```
 *
 * @example
 * ```typescript
 * // Error response for unknown method
 * const res = await handler.handleRequest({
 *   jsonrpc: "2.0", id: 2, method: "resources/list",
 * });
 * // res.error → { code: -32601, message: "Method not found: resources/list" }
 * ```
 */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// MCP tool shape exposed via tools/list
interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// JSON-RPC error codes
// ---------------------------------------------------------------------------

const ERR_METHOD_NOT_FOUND = -32601;
const ERR_INVALID_PARAMS = -32602;
const ERR_INTERNAL = -32603;

// ---------------------------------------------------------------------------
// MCP protocol version
// ---------------------------------------------------------------------------

const PROTOCOL_VERSION = "2025-11-25";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Configuration for {@link createMcpHandler}.
 *
 * Connects a {@link KitDefinition} to a database and optional runtime settings
 * (user context, CDN URLs, pre-built shell HTML). Both `kitstack dev --stdio`
 * and `serve()` construct this internally; you only build it manually in tests
 * or custom server setups.
 *
 * @example
 * ```typescript
 * // Minimal config for local development / testing
 * import { createClient } from "@libsql/client";
 * import { drizzle } from "drizzle-orm/libsql";
 * import crmKit from "./kit.config";
 *
 * const client = createClient({ url: "file:.kitstack/dev.db" });
 * const db = drizzle(client);
 *
 * const handler = createMcpHandler({ kit: crmKit, db });
 * ```
 *
 * @example
 * ```typescript
 * // Production config with CDN URLs and user context
 * const handler = createMcpHandler({
 *   kit: crmKit,
 *   db,
 *   ctx: { userId: "usr_abc123", kitId: "crm" },
 *   platformCdn: "https://cdn.kitstack.dev/platform",
 *   kitCdn: "https://cdn.kitstack.dev/kits/crm",
 * });
 * ```
 */
export interface McpHandlerConfig {
  /** The kit definition (from defineKit()). */
  kit: KitDefinition;
  /** Drizzle database client. */
  db: LibSQLDatabase;
  /** Override default context values. */
  ctx?: Partial<KitContext>;
  /**
   * Base URL for the platform CDN (vendor.js, shared.js).
   * In dev: local Vite dev server. In prod: CDN URL.
   */
  platformCdn?: string;
  /**
   * Base URL for this kit's view assets (per-view .js, style.css).
   * In dev: local Vite dev server. In prod: CDN URL.
   */
  kitCdn?: string;
  /** Pre-built shell HTML. If omitted, generated from shell-template.ts. */
  shellHtml?: string;
  /**
   * Base URL for dev relay asset serving (e.g. "https://mcp.kitstack.co/dev/67c99a1f/assets").
   * When set, the shell HTML loads view modules from this URL and the kit_view
   * response includes CSP allowing this domain.
   */
  devAssetBaseUrl?: string;
  /**
   * Authorization check function. Called for each {@link AuthzRequirement}
   * returned by a tool's `authorize` hook. If any check returns `false`,
   * the tool call is rejected with a "Forbidden" error.
   *
   * If omitted and a tool defines `authorize`, the hook is skipped
   * (all calls are permitted). Inject the real authz engine in production.
   *
   * @example
   * ```typescript
   * import { check } from "@kitstack/authz";
   *
   * const handler = createMcpHandler({
   *   kit: crmKit,
   *   db,
   *   checkAuthz: async (db, requirement, ctx) => {
   *     const result = await check(db, {
   *       subjectId: ctx.userId,
   *       ...requirement,
   *     });
   *     return result.allowed;
   *   },
   * });
   * ```
   */
  checkAuthz?: (
    db: LibSQLDatabase,
    requirement: AuthzRequirement,
    ctx: KitContext
  ) => Promise<boolean>;
}

/**
 * The MCP handler returned by {@link createMcpHandler}.
 *
 * Exposes three members:
 * - `handleRequest()` — the main JSON-RPC dispatch loop (initialize, ping,
 *   tools/list, tools/call)
 * - `callTool()` — direct tool invocation bypassing JSON-RPC, used by loaders
 *   and tests
 * - `tools` — the frozen list of MCP tool definitions (always `kit` and
 *   optionally `kit_view`)
 *
 * The handler is stateless per-request after construction. All mutable state
 * lives in the database.
 *
 * @example
 * ```typescript
 * const handler = createMcpHandler({ kit: crmKit, db });
 *
 * // Full JSON-RPC flow: initialize → tools/list → tools/call
 * await handler.handleRequest({
 *   jsonrpc: "2.0", id: 1, method: "initialize",
 * });
 * await handler.handleRequest({
 *   jsonrpc: "2.0", method: "notifications/initialized",
 * });
 * const toolsRes = await handler.handleRequest({
 *   jsonrpc: "2.0", id: 2, method: "tools/list",
 * });
 *
 * // Direct tool call (used in tests and loaders)
 * const result = await handler.callTool("add_contact", {
 *   name: "Alice", company: "Acme",
 * });
 * ```
 */
export interface McpHandler {
  /**
   * Handle a JSON-RPC request. Returns a JSON-RPC response, or `null` for
   * notifications (requests without an `id`).
   */
  handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null>;

  /**
   * Call a kit tool directly by name. Used by loaders, tests, and internal
   * dispatch. Validates args via Zod safeParse before calling the handler.
   */
  callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<KitToolResult>;

  /** The pre-computed MCP tool list (kit + kit_view). */
  readonly tools: readonly McpToolDefinition[];
}

/**
 * Create an MCP protocol handler for a kit.
 *
 * Takes a kit definition and a database connection, and returns an
 * {@link McpHandler} that speaks JSON-RPC 2.0 over any transport (stdio,
 * HTTP, WebSocket). The handler registers exactly two MCP tools:
 *
 * - **`kit`** — text-only progressive discovery and CRUD. Calling `kit()`
 *   with no arguments lists available actions; `kit(cmd)` describes one
 *   action's parameters; `kit(cmd, params)` executes it.
 * - **`kit_view`** — embedded resource rendering for MCP Apps. Calling
 *   `kit_view()` lists views; `kit_view(view)` runs the loader and
 *   returns an HTML shell as an `EmbeddedResource` with MIME type
 *   `text/html;profile=mcp-app`.
 *
 * If the kit has no views, only the `kit` tool is registered.
 *
 * @param config - Kit definition, database, and optional runtime settings
 * @returns A frozen {@link McpHandler} ready to serve requests
 *
 * @example
 * ```typescript
 * // CRM kit with stdio transport (kitstack dev --stdio)
 * import { createClient } from "@libsql/client";
 * import { drizzle } from "drizzle-orm/libsql";
 * import crmKit from "./kit.config";
 * import { createMcpHandler, runStdioTransport } from "@kitstack/sdk/runtime";
 *
 * const client = createClient({ url: "file:.kitstack/dev.db" });
 * const db = drizzle(client);
 * const handler = createMcpHandler({ kit: crmKit, db });
 *
 * // Pipe stdin/stdout through the handler
 * runStdioTransport(handler);
 * ```
 *
 * @example
 * ```typescript
 * // In tests — create handler with in-memory DB
 * import { createClient } from "@libsql/client";
 * import { drizzle } from "drizzle-orm/libsql";
 * import crmKit from "./kit.config";
 * import { createMcpHandler } from "@kitstack/sdk/runtime";
 *
 * const client = createClient({ url: ":memory:" });
 * const db = drizzle(client);
 * await client.execute(crmKit.migrationSql);
 *
 * const handler = createMcpHandler({ kit: crmKit, db });
 * const result = await handler.callTool("add_contact", {
 *   name: "Alice", company: "Acme",
 * });
 * ```
 */
export function createMcpHandler(config: McpHandlerConfig): McpHandler {
  const { kit, db } = config;
  const defaultCtx: KitContext = {
    userId: config.ctx?.userId ?? "dev-user",
    kitId: config.ctx?.kitId ?? kit.id,
  };

  // Pre-compute lookup maps
  const toolMap = new Map<string, ToolDefinition>(
    kit.tools.map((t) => [t.name, t])
  );
  const viewMap = new Map(
    (kit.views ?? []).map((v) => [v.slug, v])
  );

  // Pre-generate shell HTML for kit_view embedded resources
  const shellHtml =
    config.shellHtml ??
    (kit.views?.length
      ? generateShell({
          kitId: kit.id,
          platformCdn: config.platformCdn ?? "",
          kitCdn: config.kitCdn ?? "",
          views: (kit.views ?? []).map((v) => ({
            slug: v.slug,
            height: v.height,
          })),
        })
      : "");

  // -----------------------------------------------------------------------
  // Build the two-tool MCP definitions
  // -----------------------------------------------------------------------

  const toolNames = kit.tools.map((t) => t.name).join(", ");

  const kitTool: McpToolDefinition = {
    name: "kit",
    description: [
      `${kit.name} — ${kit.description}`,
      "",
      "  kit()              → list available actions",
      "  kit(cmd)           → describe an action's parameters",
      "  kit(cmd, params)   → run an action",
      "",
      `Actions: ${toolNames}`,
    ].join("\n"),
    inputSchema: {
      type: "object",
      properties: {
        cmd: {
          type: "string",
          description: "Action name, e.g. 'add_contact'",
        },
        params: {
          type: "object",
          description: "Action parameters",
        },
      },
    },
  };

  const mcpTools: McpToolDefinition[] = [kitTool];

  if (kit.views?.length) {
    const viewList = kit.views
      .map((v) => `${v.slug} — ${v.description}`)
      .join("; ");
    mcpTools.push({
      name: "kit_view",
      description: [
        `Show interactive UI for ${kit.name}.`,
        `Call kit_view() to list views, or kit_view(view) to display one.`,
        `Views: ${viewList}`,
      ].join(" "),
      inputSchema: {
        type: "object",
        properties: {
          view: {
            type: "string",
            description: "View slug to display",
          },
        },
      },
      _meta: {
        ui: { resourceUri: `ui://kitstack/${kit.id}/app` },
      },
    });
  }

  Object.freeze(mcpTools);

  // -----------------------------------------------------------------------
  // callTool — direct tool invocation with Zod validation
  // -----------------------------------------------------------------------

  async function callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<KitToolResult> {
    const tool = toolMap.get(name);
    if (!tool) {
      return errorResult(
        `Unknown tool: "${name}". Available: ${[...toolMap.keys()].join(", ")}`
      );
    }

    const parsed = tool.args.safeParse(args);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ");
      return errorResult(`Invalid arguments: ${issues}`);
    }

    // Run authorize hook if present and checkAuthz is configured
    if (tool.authorize && config.checkAuthz) {
      const requirements = tool.authorize(parsed.data, defaultCtx);
      for (const req of requirements) {
        const allowed = await config.checkAuthz(db, req, defaultCtx);
        if (!allowed) {
          return errorResult(
            `Forbidden: missing "${req.relation}" on ${req.objectType} "${req.objectId}"`
          );
        }
      }
    }

    return tool.handler!(db, parsed.data, defaultCtx);
  }

  // -----------------------------------------------------------------------
  // kit() — progressive discovery & execution
  // -----------------------------------------------------------------------

  async function handleKit(
    args: Record<string, unknown>
  ): Promise<KitToolResult> {
    const cmd = args.cmd as string | undefined;
    const params = args.params as Record<string, unknown> | undefined;

    // kit() → list available actions
    if (!cmd) {
      return handleKitList();
    }

    // __load_view: reload a view's data (called by useKit().reload())
    if (cmd === "__load_view") {
      const viewSlug = params?.view as string;
      const view = viewSlug ? viewMap.get(viewSlug) : undefined;
      if (!view) {
        return errorResult(`Unknown view: "${viewSlug}"`);
      }
      const data = await view.loader(db, defaultCtx);
      return {
        content: [
          { type: "text", text: JSON.stringify({ data }) },
        ],
      };
    }

    // kit(cmd) → describe parameters
    if (!params) {
      return handleKitDescribe(cmd);
    }

    // kit(cmd, params) → run
    return callTool(cmd, params);
  }

  function handleKitList(): KitToolResult {
    let text = `## ${kit.name}\n\n${kit.description}\n\n`;
    text += `### Actions\n\n`;
    text += `| Action | Description |\n|--------|-------------|\n`;
    for (const t of kit.tools) {
      text += `| \`${t.name}\` | ${t.description} |\n`;
    }
    text += `\n**Usage:** \`kit(cmd="action_name", params={...})\``;

    if (kit.views?.length) {
      text += `\n\n**Interactive UI:** \`kit_view(view="...")\` — `;
      text += kit.views
        .map((v) => `${v.slug} — ${v.description}`)
        .join("; ");
    }

    return { content: [{ type: "text", text }] };
  }

  function handleKitDescribe(cmd: string): KitToolResult {
    const tool = toolMap.get(cmd);
    if (!tool) {
      return errorResult(
        `Unknown action: "${cmd}". Run kit() to see available actions.`
      );
    }

    const schema = zodToJsonSchema(tool.args);
    let text = `## ${cmd}\n\n${tool.description}\n\n`;
    text += `### Parameters\n\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n\n`;
    text += `**Run:** \`kit(cmd="${cmd}", params={...})\``;

    return { content: [{ type: "text", text }] };
  }

  // -----------------------------------------------------------------------
  // kit_view() — embedded resource rendering
  // -----------------------------------------------------------------------

  async function handleKitView(
    args: Record<string, unknown>
  ): Promise<KitToolResult> {
    const viewSlug = args.view as string | undefined;

    // kit_view() → list available views
    if (!viewSlug) {
      if (!kit.views?.length) {
        return { content: [{ type: "text", text: "This kit has no views." }] };
      }
      const list = kit.views
        .map((v) => `- \`${v.slug}\`: ${v.name} — ${v.description}`)
        .join("\n");
      let text = `## Available Views\n\n${list}\n\n`;
      text += `**Usage:** \`kit_view(view="${kit.views[0].slug}")\``;
      return { content: [{ type: "text", text }] };
    }

    // kit_view(view) → execute loader + return embedded resource
    const view = viewMap.get(viewSlug);
    if (!view) {
      return errorResult(
        `Unknown view: "${viewSlug}". Run kit_view() to see available views.`
      );
    }

    // Execute the loader to get pre-loaded data
    let loaderData: unknown = null;
    try {
      loaderData = await view.loader(db, defaultCtx);
    } catch (err: any) {
      console.error(`[kit_view] Loader failed for "${viewSlug}":`, err.message);
    }

    // Build data payload (parsed by the shell to mount the view)
    const dataPayload = JSON.stringify({
      kit: kit.id,
      view: view.slug,
      app: view.name,
      data: loaderData,
    });

    // Build the view-specific URI
    const viewUri = `ui://kitstack/${kit.id}/${view.slug}`;

    // If devAssetBaseUrl is set, generate a dev shell that loads from the relay
    const viewShellHtml = config.devAssetBaseUrl
      ? generateDevRelayShell(kit, view.slug, config.devAssetBaseUrl)
      : shellHtml;

    // Build CSP domains — include dev asset URL if in relay dev mode
    const cspDomains: string[] = [
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ];
    if (config.devAssetBaseUrl) {
      const assetOrigin = new URL(config.devAssetBaseUrl).origin;
      cspDomains.push(assetOrigin);
    }
    if (config.platformCdn) cspDomains.push(config.platformCdn);
    if (config.kitCdn) cspDomains.push(config.kitCdn);

    // Return two content blocks: JSON data + HTML shell embedded resource
    const content: KitToolContentBlock[] = [
      { type: "text", text: dataPayload },
      {
        type: "resource",
        resource: {
          uri: viewUri,
          mimeType: "text/html;profile=mcp-app",
          text: viewShellHtml,
          _meta: {
            ui: {
              csp: {
                resourceDomains: cspDomains,
                connectDomains: cspDomains,
              },
            },
          },
        } as any,
      },
    ];

    return { content };
  }

  // -----------------------------------------------------------------------
  // handleRequest — JSON-RPC dispatch
  // -----------------------------------------------------------------------

  async function handleRequest(
    request: JsonRpcRequest
  ): Promise<JsonRpcResponse | null> {
    const { id, method, params } = request;
    const isNotification = id === undefined || id === null;

    try {
      switch (method) {
        // ── Initialize ──
        case "initialize":
          return rpcResult(id, {
            protocolVersion: PROTOCOL_VERSION,
            serverInfo: {
              name: kit.name,
              version: kit.version ?? "dev",
            },
            capabilities: {
              tools: {},
              extensions: {
                "io.modelcontextprotocol/ui": {},
              },
            },
          });

        // ── Notifications (no response) ──
        case "notifications/initialized":
          return null;

        // ── Ping ──
        case "ping":
          return rpcResult(id, {});

        // ── List tools ──
        case "tools/list":
          return rpcResult(id, { tools: mcpTools });

        // ── Call a tool ──
        case "tools/call": {
          const toolName = (params as any)?.name as string | undefined;
          if (!toolName) {
            return rpcError(id, ERR_INVALID_PARAMS, "Missing tool name");
          }
          const toolArgs =
            ((params as any)?.arguments as Record<string, unknown>) ?? {};

          let result: KitToolResult;
          if (toolName === "kit") {
            result = await handleKit(toolArgs);
          } else if (toolName === "kit_view") {
            result = await handleKitView(toolArgs);
          } else {
            return rpcError(
              id,
              ERR_INVALID_PARAMS,
              `Unknown tool: "${toolName}". Use "kit" or "kit_view".`
            );
          }

          return rpcResult(id, result);
        }

        // ── Unknown method ──
        default:
          if (isNotification) return null;
          return rpcError(
            id,
            ERR_METHOD_NOT_FOUND,
            `Method not found: ${method}`
          );
      }
    } catch (err: any) {
      return rpcError(
        id,
        ERR_INTERNAL,
        err.message ?? "Internal error"
      );
    }
  }

  return {
    handleRequest,
    callTool,
    tools: mcpTools,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rpcResult(
  id: string | number | null | undefined,
  result: unknown
): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(
  id: string | number | null | undefined,
  code: number,
  message: string
): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function errorResult(text: string): KitToolResult {
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

/**
 * Generate a shell HTML for dev relay mode that loads view modules
 * from the relay asset endpoint instead of CDN.
 */
function generateDevRelayShell(kit: KitDefinition, viewSlug: string, assetBaseUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #171512; background: #faf7f1; }
  .ks-loading { display: flex; align-items: center; justify-content: center; min-height: 200px; color: #6b6357; }
  .ks-error { padding: 16px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; }
</style>
<link rel="stylesheet" href="${assetBaseUrl}/.kitstack/devkit-entries/styles-proxy.css">
</head>
<body>
<div id="root"><div class="ks-loading">Loading view...</div></div>
<script type="module">
const KIT_ID = ${JSON.stringify(kit.id)};
const ASSET_BASE = ${JSON.stringify(assetBaseUrl)};

let requestId = 0;
const pending = new Map();
let viewMounted = false;

function send(msg) { window.parent.postMessage(msg, "*"); }
function sendRequest(method, params) {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ jsonrpc: "2.0", id, method, params });
  });
}
function sendNotification(method, params) {
  send({ jsonrpc: "2.0", method, params });
}

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.jsonrpc !== "2.0") return;
  if ("id" in msg && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error); else resolve(msg.result);
    return;
  }
  if (msg.method === "ui/notifications/tool-result" || msg.method === "ui/notifications/tool-input") {
    if (!viewMounted) handleToolResult(msg.params);
  }
});

window.__KITSTACK_MCP__ = {
  callTool: (cmd, params) =>
    sendRequest("tools/call", { name: "kit", arguments: { id: KIT_ID, cmd, params } }),
  kit: KIT_ID,
  view: "${viewSlug}",
  capabilities: {},
};

function handleToolResult(params) {
  const candidates = [params?.result?.content, params?.content];
  for (const content of candidates) {
    if (!Array.isArray(content)) continue;
    const tb = content.find(c => c.type === "text");
    if (!tb?.text) continue;
    try {
      const data = JSON.parse(tb.text);
      if (data.view) { loadView(data); return; }
    } catch {}
  }
}

async function loadView(data) {
  const root = document.getElementById("root");
  root.innerHTML = '<div class="ks-loading">Loading view...</div>';
  try {
    window.__KITSTACK_DATA__ = data.data;

    // Load view module from relay asset endpoint
    const module = await import(ASSET_BASE + "/.kitstack/devkit-entries/" + data.view + ".tsx");
    const container = document.createElement("div");
    root.innerHTML = "";
    root.appendChild(container);

    if (module.mount) {
      module.mount(container, data.data);
      viewMounted = true;
      requestAnimationFrame(() => {
        sendNotification("ui/notifications/size-changed", {
          width: document.body.scrollWidth,
          height: Math.max(document.body.scrollHeight, 400),
        });
      });
    }
  } catch (err) {
    root.innerHTML = '<div class="ks-error">View load failed: ' + err.message + '</div>';
  }
}

async function init() {
  try {
    await sendRequest("ui/initialize", {
      protocolVersion: "2026-01-26",
      appCapabilities: {},
      appInfo: { name: "KitStack Dev", version: "1.0.0" },
    });
    sendNotification("ui/notifications/initialized");
  } catch (e) {
    console.error("Init failed:", e);
  }
}

init();
</script>
</body>
</html>`;
}
