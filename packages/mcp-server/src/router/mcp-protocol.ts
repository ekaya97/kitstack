import type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpToolDefinition,
  KitRegistryItem,
} from "../framework/types";
import { dispatchToolCall } from "./tool-dispatcher";

const SERVER_INFO = {
  name: "kitstack-mcp",
  version: "0.1.0",
};

const SERVER_CAPABILITIES = {
  tools: {},
};

export async function handleMcpRequest(
  request: JsonRpcRequest,
  userId: string,
  getAllTools: () => Promise<KitRegistryItem[]>,
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>
): Promise<JsonRpcResponse> {
  try {
    switch (request.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2025-03-26",
            serverInfo: SERVER_INFO,
            capabilities: SERVER_CAPABILITIES,
          },
        };

      case "tools/list":
        return await handleToolsList(request, getAllTools);

      case "tools/call":
        return await handleToolsCall(request, userId, getAllTools, invokeKitLambda);

      default:
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32601, message: `Method not found: ${request.method}` },
        };
    }
  } catch (err: any) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: { code: -32603, message: err.message || "Internal error" },
    };
  }
}

async function handleToolsList(
  request: JsonRpcRequest,
  getAllTools: () => Promise<KitRegistryItem[]>
): Promise<JsonRpcResponse> {
  const registryItems = await getAllTools();

  const tools: McpToolDefinition[] = registryItems.map((item) => ({
    name: item.toolName,
    description: item.toolDescription,
    inputSchema: JSON.parse(item.inputSchema),
  }));

  return {
    jsonrpc: "2.0",
    id: request.id,
    result: { tools },
  };
}

async function handleToolsCall(
  request: JsonRpcRequest,
  userId: string,
  getAllTools: () => Promise<KitRegistryItem[]>,
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>
): Promise<JsonRpcResponse> {
  const params = request.params as {
    name?: string;
    arguments?: Record<string, unknown>;
  };

  if (!params?.name) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: { code: -32602, message: "Missing tool name" },
    };
  }

  const result = await dispatchToolCall(
    params.name,
    params.arguments || {},
    userId,
    getAllTools,
    invokeKitLambda
  );

  return {
    jsonrpc: "2.0",
    id: request.id,
    result,
  };
}
