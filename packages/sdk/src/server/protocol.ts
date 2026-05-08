import type { KitServerAdapter, McpToolDefinition, ProtocolHandler } from "./types";
import { buildDynamicKitDescription, buildKitInstructions } from "./description";
import { handleKitCall } from "./kit-router";
import { handleKitViewCall } from "./view-router";

const PROTOCOL_VERSION = "2025-11-25";
const APP_SHELL_URI = "ui://kitstack/app";

/** Static parts of the kit tool definition (schema never changes). */
const KIT_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    id: { type: "string", description: "Kit ID, e.g. 'crm'" },
    cmd: { type: "string", description: "Action name, e.g. 'add_contact'" },
    params: { type: "object", description: "Action parameters" },
  },
};

/** Static parts of the kit_view tool definition. */
const KIT_VIEW_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    id: { type: "string", description: "Kit ID, e.g. 'cold-outreach'" },
    view: { type: "string", description: "View slug, e.g. 'sequence-builder'" },
  },
  required: ["id"] as string[],
};

const KIT_VIEW_DESCRIPTION = [
  "Rendering companion to kit. Displays kit state as an interactive widget.",
  "Call kit_view(id) to discover available views for a kit.",
  "Use after state-changing kit operations when the user would benefit from seeing the result visually.",
  "For text results (CRUD operations, listings, exports), use kit directly.",
].join("\n");

export interface ProtocolHandlerOptions {
  adapter: KitServerAdapter;
  serverInfo?: { name: string; version: string; title?: string; description?: string };
}

/**
 * Create a shared MCP protocol handler.
 *
 * Handles initialize, tools/list, tools/call, and resources.
 * Works with any adapter (local, platform, multi-local).
 */
export function createProtocolHandler(options: ProtocolHandlerOptions): ProtocolHandler {
  const { adapter } = options;
  const serverInfo = options.serverInfo ?? { name: "kitstack", version: "0.1.0" };

  return {
    async handleRequest(request, userId) {
      const { id, method, params } = request;

      try {
        switch (method) {
          case "initialize": {
            const kits = await adapter.resolveUserKits(userId);
            const instructions = buildKitInstructions(kits);
            return rpcResult(id, {
              protocolVersion: PROTOCOL_VERSION,
              serverInfo,
              capabilities: {
                tools: {},
                resources: {},
                extensions: { "io.modelcontextprotocol/ui": {} },
              },
              ...(instructions ? { instructions } : {}),
            });
          }

          case "notifications/initialized":
            return null;

          case "ping":
            return rpcResult(id, {});

          case "tools/list": {
            const kits = await adapter.resolveUserKits(userId);
            const dynamicDesc = buildDynamicKitDescription(kits);

            const kitTool: McpToolDefinition = {
              name: "kit",
              description: dynamicDesc,
              inputSchema: KIT_INPUT_SCHEMA,
            };

            const kitViewTool: McpToolDefinition = {
              name: "kit_view",
              description: KIT_VIEW_DESCRIPTION,
              inputSchema: KIT_VIEW_INPUT_SCHEMA,
              _meta: {
                ui: { resourceUri: APP_SHELL_URI },
                "ui/resourceUri": APP_SHELL_URI,
              },
            };

            const hasViews = kits.some((k) => k.views.length > 0);
            const tools = hasViews ? [kitTool, kitViewTool] : [kitTool];

            return rpcResult(id, { tools });
          }

          case "resources/list": {
            const kits = await adapter.resolveUserKits(userId);
            const hasViews = kits.some((k) => k.views.length > 0);
            if (!hasViews) return rpcResult(id, { resources: [] });

            return rpcResult(id, {
              resources: [{
                uri: APP_SHELL_URI,
                name: "KitStack App",
                mimeType: "text/html;profile=mcp-app",
              }],
            });
          }

          case "resources/read": {
            const readParams = params as { uri?: string } | undefined;
            const uri = readParams?.uri;
            if (uri !== APP_SHELL_URI) {
              return rpcError(id, -32602, `Unknown resource: ${uri}`);
            }

            const kits = await adapter.resolveUserKits(userId);
            const kitWithViews = kits.find((k) => k.views.length > 0);
            if (!kitWithViews) {
              return rpcError(id, -32602, "No kits with views activated");
            }

            const html = await adapter.getShellHtml(kitWithViews.id);
            if (!html) {
              return rpcError(id, -32603, "Shell HTML not available");
            }

            return rpcResult(id, {
              contents: [{
                uri,
                mimeType: "text/html;profile=mcp-app",
                text: html,
              }],
            });
          }

          case "tools/call": {
            const toolParams = params as { name?: string; arguments?: Record<string, unknown> } | undefined;
            const toolName = toolParams?.name;
            const toolArgs = toolParams?.arguments ?? {};

            if (toolName === "kit") {
              const result = await handleKitCall(
                toolArgs as { id?: string; cmd?: string; params?: Record<string, unknown> },
                userId,
                adapter
              );
              return rpcResult(id, result);
            }

            if (toolName === "kit_view") {
              const result = await handleKitViewCall(
                toolArgs as { id?: string; view?: string },
                userId,
                adapter
              );
              return rpcResult(id, result);
            }

            return rpcError(id, -32602, `Unknown tool: ${toolName}. Use "kit" or "kit_view".`);
          }

          default:
            return rpcError(id, -32601, `Method not found: ${method}`);
        }
      } catch (err: any) {
        return rpcError(id, -32603, err.message || "Internal error");
      }
    },
  };
}

// --- JSON-RPC helpers ---

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0" as const, id: id ?? null, result };
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } };
}
