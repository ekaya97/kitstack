/**
 * Core MCP JSON-RPC protocol handler.
 *
 * Shared by `kitstack dev` and `serve()`. Stateless per-request after
 * initialization — the factory pre-computes tool maps and the tools/list
 * response so each request is a fast lookup + dispatch.
 *
 * Handles: initialize, notifications/initialized, ping, tools/list, tools/call.
 *
 * T-0024
 */

import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type {
  KitDefinition,
  KitContext,
  KitToolResult,
  ToolDefinition,
} from "../types";
import { zodToJsonSchema } from "./zod-to-json-schema";

// ---------------------------------------------------------------------------
// JSON-RPC types
// ---------------------------------------------------------------------------

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

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
// JSON-RPC error codes (from spec + MCP convention)
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

export interface McpHandlerConfig {
  /** The kit definition (from defineKit()). */
  kit: KitDefinition;
  /** Drizzle database client. */
  db: LibSQLDatabase;
  /** Override default context values. */
  ctx?: Partial<KitContext>;
}

export interface McpHandler {
  /**
   * Handle a JSON-RPC request. Returns a JSON-RPC response, or `null` for
   * notifications (requests without an `id`).
   */
  handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null>;

  /**
   * Call a kit tool directly. Used by loaders, tests, and view reload.
   * Validates args via Zod safeParse before dispatching.
   */
  callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<KitToolResult>;

  /** The pre-computed MCP tool list (for tools/list). */
  readonly tools: readonly McpToolDefinition[];
}

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

  // Build the MCP tool list (returned by tools/list)
  const mcpTools: McpToolDefinition[] = kit.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.args),
  }));

  // Add kit_view tool if the kit declares views
  if (kit.views?.length) {
    const viewList = kit.views
      .map((v) => `${v.slug} — ${v.description}`)
      .join("; ");
    mcpTools.push({
      name: "kit_view",
      description: `Show interactive UI for ${kit.name}. Views: ${viewList}`,
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

  // Freeze the tool list so consumers can't mutate it
  Object.freeze(mcpTools);

  // -----------------------------------------------------------------------
  // callTool — direct tool invocation with Zod validation
  // -----------------------------------------------------------------------

  async function callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<KitToolResult> {
    // __load_view: reload a view's data (called by useKit().reload())
    if (name === "__load_view") {
      const viewSlug = args.view as string;
      const view = viewSlug ? viewMap.get(viewSlug) : undefined;
      if (!view) {
        return errorResult(`Unknown view: ${viewSlug}`);
      }
      const data = await view.loader(db, defaultCtx);
      return { content: [{ type: "text", text: JSON.stringify(data) }] };
    }

    // kit_view: render an interactive view
    if (name === "kit_view") {
      return handleKitView(args);
    }

    // Regular tool dispatch
    const tool = toolMap.get(name);
    if (!tool) {
      return errorResult(`Unknown tool: ${name}`);
    }

    // Validate arguments
    const parsed = tool.args.safeParse(args);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ");
      return errorResult(`Invalid arguments: ${issues}`);
    }

    return tool.handler!(db, parsed.data, defaultCtx);
  }

  // -----------------------------------------------------------------------
  // kit_view handling
  // -----------------------------------------------------------------------

  async function handleKitView(
    args: Record<string, unknown>
  ): Promise<KitToolResult> {
    const viewSlug = args.view as string | undefined;

    // No slug → list available views
    if (!viewSlug) {
      const listing = (kit.views ?? [])
        .map((v) => `- **${v.slug}** — ${v.description}`)
        .join("\n");
      return {
        content: [
          {
            type: "text",
            text: listing || "This kit has no views.",
          },
        ],
      };
    }

    const view = viewMap.get(viewSlug);
    if (!view) {
      return errorResult(`Unknown view: ${viewSlug}`);
    }

    // Execute the view's loader (server-side data)
    const data = await view.loader(db, defaultCtx);
    const dataJson = JSON.stringify({ view: view.slug, data });

    // Return data as text. The transport layer (stdio/relay) is responsible
    // for attaching the shell HTML as an embedded resource if needed.
    return {
      content: [{ type: "text", text: dataJson }],
    };
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

          const result = await callTool(toolName, toolArgs);
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
