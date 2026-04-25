// Shared protocol types — owned by the SDK, re-exported here for convenience.
export type {
  KitToolInvocation,
  KitToolContentBlock,
  KitToolResult,
  ToolDefinition,
  KitDefinition,
  KitToolInput,
} from "../../../sdk/src/types";

// Re-export JSON-RPC types from the SDK runtime
export type {
  JsonRpcRequest,
  JsonRpcResponse,
} from "../../../sdk/src/runtime/mcp-handler";

// --- MCP Tool Definition (router-level, includes _meta) ---

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

// --- DynamoDB Items (server infrastructure, not part of SDK contract) ---

export interface KitRegistryItem {
  kitId: string;
  toolName: string;
  toolDescription: string;
  inputSchema: string;
  kitName: string;
  kitDescription?: string;
  lambdaResource?: string | null;
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
  data: string;
  ttl: number;
}
