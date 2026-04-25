import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { KitDefinition, KitContext, KitToolResult } from "../types";

/**
 * Host capabilities that can be toggled in the DevKit UI.
 * These mirror what Claude.ai exposes to MCP Apps.
 */
export interface HostCapabilities {
  downloadFile: boolean;
  openLinks: boolean;
  clipboardWrite: boolean;
}

/**
 * A logged tool call for the DevKit inspector panel.
 */
export interface ToolCallLog {
  timestamp: number;
  toolName: string;
  args: Record<string, unknown>;
  result: KitToolResult;
  durationMs: number;
}

/**
 * Options for creating a mock MCP Apps host.
 *
 * @example
 * ```typescript
 * import { createMcpAppsHost } from "@kitstack/sdk/devkit";
 * import kit from "./kits/crm/kit.config";
 *
 * const host = createMcpAppsHost({
 *   kit,
 *   db,
 *   ctx: { userId: "dev-user", kitId: kit.id },
 *   onToolCall: (log) => console.log(`${log.toolName} took ${log.durationMs}ms`),
 * });
 * ```
 */
export interface McpAppsHostOptions {
  /** The kit definition (from `defineKit()`). */
  kit: KitDefinition;
  /** Drizzle database client for tool execution. */
  db: LibSQLDatabase;
  /** Kit context with user identity. */
  ctx: KitContext;
  /** Override default capabilities (all enabled by default). */
  capabilities?: Partial<HostCapabilities>;
  /** Called after every tool call — use for the DevKit inspector log. */
  onToolCall?: (log: ToolCallLog) => void;
  /** Called when the app shell reports a size change. */
  onSizeChanged?: (width: number, height: number) => void;
  /** Called when the app requests a file download. */
  onDownloadFile?: (filename: string, mimeType: string, content: string) => void;
  /** Called when the app requests opening an external link. */
  onOpenLink?: (url: string) => void;
}

/**
 * Create a mock MCP Apps host that implements the postMessage protocol
 * Claude.ai uses for rendering views in sandboxed iframes.
 *
 * The host handles the full protocol lifecycle:
 * - `ui/initialize` — responds with configurable host capabilities
 * - `ui/notifications/initialized` — app shell is ready
 * - `tools/call` — routes to the kit's actual tool handlers
 * - `__load_view` — re-executes a view's loader (used by `reload()`)
 * - `ui/download-file` — delegates to `onDownloadFile` callback
 * - `ui/open-link` — delegates to `onOpenLink` callback
 * - `ui/notifications/size-changed` — delegates to `onSizeChanged` callback
 *
 * @param options - Host configuration with kit, database, and callbacks
 * @returns Host object with `handleMessage()`, `buildToolResultNotification()`,
 *   capability management, and tool call log access
 *
 * @example
 * ```typescript
 * // Wire to an iframe in a browser context (View DevKit)
 * import { createMcpAppsHost } from "@kitstack/sdk/devkit";
 * import kit from "./kits/crm/kit.config";
 *
 * const host = createMcpAppsHost({ kit, db, ctx });
 *
 * // Send initial data for the "pipeline" view
 * const notification = await host.buildToolResultNotification("pipeline");
 * iframe.contentWindow.postMessage(notification, "*");
 *
 * // Handle messages from the iframe
 * window.addEventListener("message", async (e) => {
 *   if (e.source !== iframe.contentWindow) return;
 *   const response = await host.handleMessage(e.data);
 *   if (response) iframe.contentWindow.postMessage(response, "*");
 * });
 * ```
 */
export function createMcpAppsHost(options: McpAppsHostOptions) {
  const { kit, db, ctx, onToolCall, onSizeChanged, onDownloadFile, onOpenLink } = options;
  const capabilities: HostCapabilities = {
    downloadFile: options.capabilities?.downloadFile ?? true,
    openLinks: options.capabilities?.openLinks ?? true,
    clipboardWrite: options.capabilities?.clipboardWrite ?? true,
  };

  const toolCallLogs: ToolCallLog[] = [];

  /**
   * Handle an incoming postMessage from the app shell iframe.
   * Returns a JSON-RPC response to send back, or null for notifications.
   */
  async function handleMessage(msg: any): Promise<any | null> {
    if (!msg || msg.jsonrpc !== "2.0") return null;

    // JSON-RPC request (has id) — needs a response
    if ("id" in msg && msg.method) {
      return handleRequest(msg.id, msg.method, msg.params ?? {});
    }

    // JSON-RPC notification (no id) — fire and forget
    if (msg.method) {
      handleNotification(msg.method, msg.params ?? {});
      return null;
    }

    return null;
  }

  async function handleRequest(id: number | string, method: string, params: any): Promise<any> {
    switch (method) {
      case "ui/initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2026-01-26",
            hostCapabilities: {
              downloadFile: capabilities.downloadFile,
              openLinks: capabilities.openLinks,
              clipboardWrite: capabilities.clipboardWrite,
            },
            hostInfo: { name: "KitStack DevKit", version: "1.0.0" },
          },
        };

      case "tools/call":
        return handleToolsCall(id, params);

      case "ui/download-file":
        if (onDownloadFile && params?.contents?.[0]?.resource) {
          const res = params.contents[0].resource;
          const filename = res.uri?.replace("file:///", "") ?? "download";
          onDownloadFile(filename, res.mimeType ?? "text/plain", res.text ?? "");
        }
        return { jsonrpc: "2.0", id, result: {} };

      case "ui/open-link":
        if (onOpenLink && params?.url) {
          onOpenLink(params.url);
        }
        return { jsonrpc: "2.0", id, result: {} };

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  }

  function handleNotification(method: string, params: any): void {
    switch (method) {
      case "ui/notifications/initialized":
        // App shell is ready — nothing to do, tool-result is sent separately
        break;

      case "ui/notifications/size-changed":
        if (onSizeChanged && params?.width != null && params?.height != null) {
          onSizeChanged(params.width, params.height);
        }
        break;

      case "ui/notifications/sandbox-resource-ready":
        // Sandbox proxy forwarding — not used in DevKit (we skip the double iframe)
        break;
    }
  }

  async function handleToolsCall(id: number | string, params: any): Promise<any> {
    const { name, arguments: toolArgs } = params ?? {};

    // Handle kit() call
    if (name === "kit" && toolArgs) {
      const { id: kitId, cmd, params: cmdParams } = toolArgs;

      // Handle __load_view command (view reload)
      if (cmd === "__load_view" && cmdParams?.view) {
        return handleLoadView(id, cmdParams.view);
      }

      // Route to kit tool
      if (cmd) {
        return handleKitToolCall(id, cmd, cmdParams ?? {});
      }
    }

    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: "Invalid tool call" },
    };
  }

  async function handleKitToolCall(
    id: number | string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<any> {
    const tool = kit.tools.find((t) => t.name === toolName);
    if (!tool) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: `Tool "${toolName}" not found in kit "${kit.id}".` }],
          isError: true,
        },
      };
    }

    const start = Date.now();
    try {
      const parsedArgs = tool.args.parse(args);
      const result = await tool.handler!(db, parsedArgs, ctx);
      const durationMs = Date.now() - start;

      const log: ToolCallLog = { timestamp: start, toolName, args, result, durationMs };
      toolCallLogs.push(log);
      onToolCall?.(log);

      return { jsonrpc: "2.0", id, result };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const errorResult: KitToolResult = {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };

      const log: ToolCallLog = { timestamp: start, toolName, args, result: errorResult, durationMs };
      toolCallLogs.push(log);
      onToolCall?.(log);

      return { jsonrpc: "2.0", id, result: errorResult };
    }
  }

  async function handleLoadView(id: number | string, viewSlug: string): Promise<any> {
    const view = kit.views?.find((v) => v.slug === viewSlug);
    if (!view) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: `View "${viewSlug}" not found in kit "${kit.id}".` }],
          isError: true,
        },
      };
    }

    try {
      const data = await view.loader(db, ctx);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify({ view: viewSlug, data }) }],
        },
      };
    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: `Loader error: ${err.message}` }],
          isError: true,
        },
      };
    }
  }

  /**
   * Build the tool-result notification to send to the iframe after it initializes.
   * This is the initial data payload that the shell uses to render the view.
   */
  async function buildToolResultNotification(viewSlug: string): Promise<any> {
    const view = kit.views?.find((v) => v.slug === viewSlug);
    if (!view) return null;

    const data = await view.loader(db, ctx);

    return {
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: {
        result: {
          content: [{ type: "text", text: JSON.stringify({ view: viewSlug, data }) }],
        },
      },
    };
  }

  return {
    handleMessage,
    buildToolResultNotification,
    getCapabilities: () => ({ ...capabilities }),
    setCapabilities: (caps: Partial<HostCapabilities>) => Object.assign(capabilities, caps),
    getToolCallLogs: () => [...toolCallLogs],
    clearToolCallLogs: () => { toolCallLogs.length = 0; },
  };
}

export type McpAppsHost = ReturnType<typeof createMcpAppsHost>;
