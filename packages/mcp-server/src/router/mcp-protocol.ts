import type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpToolDefinition,
  KitRegistryItem,
  UserKitDbItem,
  OnionToolInput,
} from "../framework/types";
import { dispatchToolCall } from "./tool-dispatcher";
import { buildOnionTools, handleOnionCall } from "./onion-handler";
import { checkAndClearToolsChanged } from "../framework/dynamo";

/**
 * When total entitled tools exceed this threshold, switch to onion mode.
 * Set to 0 to force onion mode (for testing).
 * Set to Infinity to always use flat mode.
 */
export const ONION_MODE_THRESHOLD = parseInt(process.env.ONION_MODE_THRESHOLD || "40", 10);

const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 28 28" fill="none"><rect x="2.5" y="11.5" width="23" height="13" rx="2.5" stroke="#1a1814" stroke-width="1.5" fill="#faf7f1"/><rect x="5.5" y="7.5" width="17" height="4" rx="1.5" stroke="#1a1814" stroke-width="1.3" fill="#f7d9c8"/><rect x="8.5" y="3.5" width="11" height="4" rx="1.5" stroke="#1a1814" stroke-width="1.3" fill="#d65a2f"/></svg>';

const SERVER_INFO = {
  name: "kitstack",
  version: "0.2.0",
  title: "KitStack",
  description: "AI tool kits with persistence, interactive UI, and cross-session memory. Skills are free. Kits replace your SaaS.",
  websiteUrl: "https://kitstack.co",
  icons: [
    {
      src: "data:image/svg+xml;base64," + Buffer.from(ICON_SVG).toString("base64"),
      mimeType: "image/svg+xml",
    },
  ],
};

const SERVER_CAPABILITIES = {
  tools: {},
};

export interface McpResponse {
  response: JsonRpcResponse;
  notifications?: Array<{ method: string; params?: Record<string, unknown> }>;
}

export async function handleMcpRequest(
  request: JsonRpcRequest,
  userId: string,
  getAllTools: () => Promise<KitRegistryItem[]>,
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>,
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>
): Promise<McpResponse> {
  try {
    // Check if tools have changed since last request
    const toolsChanged = await checkAndClearToolsChanged(userId);
    const notifications: McpResponse["notifications"] = [];
    if (toolsChanged) {
      notifications.push({ method: "notifications/tools/list_changed" });
    }

    let response: JsonRpcResponse;

    switch (request.method) {
      case "initialize":
        response = {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2025-03-26",
            serverInfo: SERVER_INFO,
            capabilities: SERVER_CAPABILITIES,
          },
        };
        break;

      case "tools/list":
        response = await handleToolsList(request, userId, getAllTools, getUserKitDbs);
        break;

      case "tools/call":
        response = await handleToolsCall(request, userId, getAllTools, getUserKitDbs, invokeKitLambda);
        break;

      default:
        response = {
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32601, message: `Method not found: ${request.method}` },
        };
    }

    return { response, notifications: notifications.length > 0 ? notifications : undefined };
  } catch (err: any) {
    return {
      response: {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32603, message: err.message || "Internal error" },
      },
    };
  }
}

/**
 * Filter registry items to only tools for kits the user has activated.
 */
function filterByEntitlement(
  registryItems: KitRegistryItem[],
  userKitDbs: UserKitDbItem[]
): KitRegistryItem[] {
  const activatedKitIds = new Set(userKitDbs.map((db) => db.kitId));
  return registryItems.filter((item) => activatedKitIds.has(item.kitId));
}

async function handleToolsList(
  request: JsonRpcRequest,
  userId: string,
  getAllTools: () => Promise<KitRegistryItem[]>,
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>
): Promise<JsonRpcResponse> {
  const [allRegistryItems, userDbs] = await Promise.all([
    getAllTools(),
    getUserKitDbs(userId),
  ]);

  const entitledItems = filterByEntitlement(allRegistryItems, userDbs);

  let tools: McpToolDefinition[];

  if (entitledItems.length <= ONION_MODE_THRESHOLD) {
    // Flat mode: return all entitled tools directly
    tools = entitledItems.map((item) => ({
      name: item.toolName,
      description: item.toolDescription,
      inputSchema: JSON.parse(item.inputSchema),
    }));
  } else {
    // Onion mode: return 1 meta-tool per kit
    tools = buildOnionTools(entitledItems);
  }

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
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>,
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

  const [allRegistryItems, userDbs] = await Promise.all([
    getAllTools(),
    getUserKitDbs(userId),
  ]);

  const entitledItems = filterByEntitlement(allRegistryItems, userDbs);

  // Check if this is an onion-mode kit call (tool name matches a kitId)
  const kitIds = new Set(entitledItems.map((t) => t.kitId));
  const isOnionCall = kitIds.has(params.name) && !entitledItems.some((t) => t.toolName === params.name);

  let result;

  if (isOnionCall) {
    const input = params.arguments as unknown as OnionToolInput;
    if (!input?.action) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32602, message: "Missing 'action' parameter. Use discover, describe, or execute." },
      };
    }
    result = await handleOnionCall(
      params.name,
      input,
      userId,
      async () => entitledItems,
      invokeKitLambda
    );
  } else {
    // Flat mode or direct tool call
    result = await dispatchToolCall(
      params.name,
      params.arguments || {},
      userId,
      async () => entitledItems,
      invokeKitLambda
    );
  }

  return {
    jsonrpc: "2.0",
    id: request.id,
    result,
  };
}
