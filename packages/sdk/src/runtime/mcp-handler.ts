/**
 * Core MCP JSON-RPC protocol handler.
 *
 * Thin wrapper around the shared protocol layer in `../server/`.
 * Creates a local adapter from the kit definition and database,
 * then delegates all protocol handling to `createProtocolHandler`.
 *
 * Preserves the `McpHandler` interface for backward compatibility
 * with `kitstack dev`, `serve()`, and tests.
 */

import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type {
  KitDefinition,
  KitContext,
  KitToolResult,
  AuthzRequirement,
} from "../types";
import { createProtocolHandler } from "../server/protocol";
import { localAdapter } from "../server/adapters/local";
import type { McpToolDefinition } from "../server/types";

// ---------------------------------------------------------------------------
// JSON-RPC types (re-exported for backward compatibility)
// ---------------------------------------------------------------------------

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface McpHandlerConfig {
  kit: KitDefinition;
  db: LibSQLDatabase;
  ctx?: Partial<KitContext>;
  platformCdn?: string;
  kitCdn?: string;
  shellHtml?: string;
  devAssetBaseUrl?: string;
  checkAuthz?: (
    db: LibSQLDatabase,
    requirement: AuthzRequirement,
    ctx: KitContext
  ) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// McpHandler interface
// ---------------------------------------------------------------------------

export interface McpHandler {
  handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null>;
  callTool(name: string, args: Record<string, unknown>): Promise<KitToolResult>;
  readonly tools: readonly McpToolDefinition[];
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an MCP protocol handler for a kit.
 *
 * @example
 * ```typescript
 * const handler = createMcpHandler({ kit: crmKit, db });
 * const result = await handler.callTool("add_contact", { name: "Alice" });
 * ```
 */
export function createMcpHandler(config: McpHandlerConfig): McpHandler {
  const { kit, db } = config;
  const userId = config.ctx?.userId ?? "dev-user";

  const adapter = localAdapter({
    kit,
    db,
    userId,
    shellHtml: config.shellHtml,
    platformCdn: config.platformCdn,
    kitCdn: config.kitCdn,
    devAssetBaseUrl: config.devAssetBaseUrl,
    checkAuthz: config.checkAuthz,
  });

  const protocol = createProtocolHandler({
    adapter,
    serverInfo: {
      name: kit.name,
      version: kit.version ?? "dev",
    },
  });

  // Pre-compute tools list for the `tools` property
  let cachedTools: readonly McpToolDefinition[] | null = null;

  return Object.freeze({
    async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
      const response = await protocol.handleRequest(request, userId);
      return response as JsonRpcResponse | null;
    },

    async callTool(name: string, args: Record<string, unknown>): Promise<KitToolResult> {
      return adapter.executeTool(kit.id, name, args, userId);
    },

    get tools(): readonly McpToolDefinition[] {
      if (!cachedTools) {
        // Build tools synchronously from kit definition
        const { buildDynamicKitDescription } = require("../server/description");
        const kits = [{
          id: kit.id,
          name: kit.name,
          description: kit.description,
          triggers: kit.triggers ?? [],
          instructions: kit.instructions || null,
          tools: kit.tools.map((t) => ({ name: t.name, description: t.description, inputSchema: {} })),
          views: (kit.views ?? []).map((v) => ({ slug: v.slug, name: v.name, description: v.description })),
        }];
        const desc = buildDynamicKitDescription(kits);
        const tools: McpToolDefinition[] = [
          {
            name: "kit",
            description: desc,
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: `Kit ID, e.g. '${kit.id}'` },
                cmd: { type: "string", description: "Action name, e.g. 'add_contact'" },
                params: { type: "object", description: "Action parameters" },
              },
            },
          },
        ];
        if (kit.views?.length) {
          tools.push({
            name: "kit_view",
            description: "Rendering companion to kit. Displays kit state as an interactive widget.\nCall kit_view(id) to discover available views for a kit.\nUse after state-changing kit operations when the user would benefit from seeing the result visually.\nFor text results (CRUD operations, listings, exports), use kit directly.",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: `Kit ID, e.g. '${kit.id}'` },
                view: { type: "string", description: "View slug to display" },
              },
              required: ["id"],
            },
          });
        }
        cachedTools = Object.freeze(tools);
      }
      return cachedTools;
    },
  });
}

// Re-export for backward compatibility
export { zodToJsonSchema } from "./zod-to-json-schema";
