import type {
  JsonRpcRequest,
  JsonRpcResponse,
  KitRegistryItem,
  UserKitDbItem,
  KitToolInput,
} from "./types";
import { KIT_TOOL_DEFINITION, KIT_VIEW_TOOL_DEFINITION, handleKitCall, handleKitViewCall, buildDynamicKitDescription, buildKitInstructions } from "./kit-handler";
import { listAppResources, readAppResource } from "./app-resources";

const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 28 28" fill="none"><rect x="2.5" y="11.5" width="23" height="13" rx="2.5" stroke="#1a1814" stroke-width="1.5" fill="#faf7f1"/><rect x="5.5" y="7.5" width="17" height="4" rx="1.5" stroke="#1a1814" stroke-width="1.3" fill="#f7d9c8"/><rect x="8.5" y="3.5" width="11" height="4" rx="1.5" stroke="#1a1814" stroke-width="1.3" fill="#d65a2f"/></svg>';

const SERVER_INFO = {
  name: "kitstack",
  version: "0.3.0",
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
  resources: {},
  extensions: {
    "io.modelcontextprotocol/ui": {},
  },
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
  try {
    let response: JsonRpcResponse;

    switch (request.method) {
      case "initialize": {
        // Log client capabilities to see if MCP Apps is supported
        console.log("[MCP] Client initialize params:", JSON.stringify(request.params, null, 2));
        const [initTools, initDbs] = await Promise.all([
          getAllTools(),
          getUserKitDbs(userId),
        ]);
        const initKitIds = new Set(initDbs.map((db) => db.kitId));
        const instructions = buildKitInstructions(initTools, initKitIds);
        response = {
          jsonrpc: "2.0",
          id: request.id ?? null,
          result: {
            protocolVersion: "2025-11-25",
            serverInfo: SERVER_INFO,
            capabilities: SERVER_CAPABILITIES,
            ...(instructions ? { instructions } : {}),
          },
        };
        break;
      }

      case "tools/list": {
        const [listTools, listDbs] = await Promise.all([
          getAllTools(),
          getUserKitDbs(userId),
        ]);
        const listKitIds = new Set(listDbs.map((db) => db.kitId));
        const dynamicDesc = buildDynamicKitDescription(listTools, listKitIds);
        console.log("[MCP] tools/list — dynamic kit description:\n" + dynamicDesc);
        const kitTool = { ...KIT_TOOL_DEFINITION, description: dynamicDesc };
        response = {
          jsonrpc: "2.0",
          id: request.id ?? null,
          result: { tools: [kitTool, KIT_VIEW_TOOL_DEFINITION] },
        };
        break;
      }

      case "tools/call":
        response = await handleToolsCall(
          request,
          userId,
          getAllTools,
          getUserKitDbs,
          invokeKitLambda
        );
        break;

      case "resources/list":
        response = await handleResourcesList(request, userId, getUserKitDbs);
        break;

      case "resources/read":
        response = await handleResourcesRead(request, userId, getUserKitDbs);
        break;

      default:
        response = {
          jsonrpc: "2.0",
          id: request.id ?? null,
          error: { code: -32601, message: `Method not found: ${request.method}` },
        };
    }

    return { response };
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

  if (params?.name === "kit_view") {
    const args = (params.arguments || {}) as { id?: string; view?: string };
    const result = await handleKitViewCall(args, userId, getUserKitDbs, getAllTools, invokeKitLambda);
    return { jsonrpc: "2.0" as const, id: request.id ?? null, result };
  }

  if (params?.name !== "kit") {
    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: { code: -32602, message: `Unknown tool: ${params?.name}. Use "kit" or "kit_view".` },
    };
  }

  const input = (params.arguments || {}) as KitToolInput;

  const result = await handleKitCall(
    input,
    userId,
    getAllTools,
    getUserKitDbs,
    invokeKitLambda
  );

  return {
    jsonrpc: "2.0",
    id: request.id ?? null,
    result,
  };
}

async function handleResourcesList(
  request: JsonRpcRequest,
  userId: string,
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>
): Promise<JsonRpcResponse> {
  const userDbs = await getUserKitDbs(userId);
  const activatedKitIds = new Set(userDbs.map((db) => db.kitId));
  const resources = listAppResources(activatedKitIds);

  return {
    jsonrpc: "2.0",
    id: request.id ?? null,
    result: { resources },
  };
}

async function handleResourcesRead(
  request: JsonRpcRequest,
  userId: string,
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>
): Promise<JsonRpcResponse> {
  const uri = (request.params as { uri?: string })?.uri;
  if (!uri) {
    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: { code: -32602, message: "Missing uri parameter" },
    };
  }

  const userDbs = await getUserKitDbs(userId);
  const activatedKitIds = new Set(userDbs.map((db) => db.kitId));
  const content = await readAppResource(uri, userId, activatedKitIds);

  if (!content) {
    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: { code: -32602, message: `Resource not found: ${uri}` },
    };
  }

  return {
    jsonrpc: "2.0",
    id: request.id ?? null,
    result: { contents: [content] },
  };
}
