/**
 * MCP protocol handler for the KitStack platform.
 *
 * Thin wrapper that creates a platform adapter and delegates
 * to the shared protocol handler from @kitstack/sdk/server.
 */

import type {
  JsonRpcRequest,
  JsonRpcResponse,
  KitRegistryItem,
  UserKitDbItem,
} from "./types";
import { createProtocolHandler } from "../../../sdk/src/server/protocol";
import { platformAdapter } from "./platform-adapter";

const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 28 28" fill="none"><rect x="2.5" y="11.5" width="23" height="13" rx="2.5" stroke="#1a1814" stroke-width="1.5" fill="#faf7f1"/><rect x="5.5" y="7.5" width="17" height="4" rx="1.5" stroke="#1a1814" stroke-width="1.3" fill="#f7d9c8"/><rect x="8.5" y="3.5" width="11" height="4" rx="1.5" stroke="#1a1814" stroke-width="1.3" fill="#d65a2f"/></svg>';

const SERVER_INFO = {
  name: "kitstack",
  version: "0.3.0",
  title: "KitStack",
  description: "AI tool kits with persistence, interactive UI, and cross-session memory. Skills are free. Kits replace your SaaS.",
};

export interface McpResponse {
  response: JsonRpcResponse;
}

export async function handleMcpRequest(
  request: JsonRpcRequest,
  userId: string,
  getAllTools: () => Promise<KitRegistryItem[]>,
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>,
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>
): Promise<McpResponse> {
  const adapter = platformAdapter({ getAllTools, getUserKitDbs, invokeKitLambda });

  const protocol = createProtocolHandler({
    adapter,
    serverInfo: SERVER_INFO,
  });

  try {
    const response = await protocol.handleRequest(request, userId);

    if (response === null) {
      // Notification — return empty success
      return {
        response: { jsonrpc: "2.0", id: null, result: {} },
      };
    }

    return { response: response as JsonRpcResponse };
  } catch (err: any) {
    return {
      response: {
        jsonrpc: "2.0",
        id: request.id ?? null,
        error: { code: -32603, message: err.message || "Internal error" },
      },
    };
  }
}
