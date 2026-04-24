import type { z } from "zod";

// --- Kit Tool Protocol (Router ↔ Kit Lambda) ---

export interface KitToolInvocation {
  toolName: string;
  args: Record<string, unknown>;
  userId: string;
  kitId: string;
  dbUrl: string;
  dbToken: string;
}

export type KitToolContentBlock =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType: string; text: string } };

export interface KitToolResult {
  content: KitToolContentBlock[];
  isError?: boolean;
}

// --- Kit Definition (what developers define) ---

export interface ToolDefinition<TArgs extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  args: TArgs;
  handler: (db: any, args: z.infer<TArgs>) => Promise<KitToolResult>;
}

export interface KitDefinition {
  id: string;
  name: string;
  description: string;
  schema: Record<string, any>;
  migrationSql: string;
  instructions: string;
  tools: ToolDefinition[];
}

// --- Kit Tool Input (onion pattern) ---

export interface KitToolInput {
  id?: string;
  cmd?: string;
  params?: Record<string, unknown>;
}

// --- DynamoDB Items ---

export interface KitRegistryItem {
  kitId: string;
  toolName: string;
  toolDescription: string;
  inputSchema: string; // JSON-serialized Zod-to-JSON-Schema
  kitName: string;
  kitDescription?: string;
}

export interface UserKitDbItem {
  userId: string;
  kitId: string;
  dbUrl: string;
  dbToken: string;
  provisionedAt: string;
  status?: "active" | "deactivated";
}

export interface OAuthStoreItem {
  pk: string;
  sk: string;
  data: string; // JSON
  ttl: number; // Unix timestamp for DynamoDB TTL
}

// --- MCP Protocol ---

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}
