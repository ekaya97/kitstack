import type { KitToolResult } from "../types";

/**
 * A resolved kit with all metadata needed for the protocol layer.
 * Produced by adapters from whatever data source they use
 * (local KitDefinition, Turso registry, manifest files, etc.)
 */
export interface ResolvedKit {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  instructions: string | null;
  tools: ResolvedTool[];
  views: ResolvedView[];
}

export interface ResolvedTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ResolvedView {
  slug: string;
  name: string;
  description: string;
}

/**
 * The adapter interface. Implementations provide data and execution
 * for a specific runtime environment:
 *
 * - **local** — single kit, in-process, local SQLite (dev + self-hosted)
 * - **multi-local** — multiple kits, in-process (self-hosted monolith)
 * - **platform** — multi-kit, Lambda-based, Turso + DynamoDB (KitStack cloud)
 */
export interface KitServerAdapter {
  /** Return the kits available to this user. */
  resolveUserKits(userId: string): Promise<ResolvedKit[]>;

  /** Execute a tool handler and return the result. */
  executeTool(
    kitId: string,
    toolName: string,
    args: Record<string, unknown>,
    userId: string
  ): Promise<KitToolResult>;

  /** Execute a view's loader and return the data. */
  executeLoader(
    kitId: string,
    viewSlug: string,
    userId: string
  ): Promise<unknown>;

  /** Get the HTML shell for rendering embedded views. */
  getShellHtml(kitId: string): Promise<string>;
}

/**
 * MCP tool definition shape returned by tools/list.
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  _meta?: Record<string, unknown>;
}

/**
 * The protocol handler returned by {@link createProtocolHandler}.
 */
export interface ProtocolHandler {
  handleRequest(
    request: { id?: unknown; method: string; params?: unknown },
    userId: string
  ): Promise<{ jsonrpc: "2.0"; id: unknown; result?: unknown; error?: { code: number; message: string } } | null>;
}
