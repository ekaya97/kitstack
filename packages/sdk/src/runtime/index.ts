export {
  createMcpHandler,
  type McpHandler,
  type McpHandlerConfig,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./mcp-handler";

export {
  runStdioTransport,
  type StdioTransportOptions,
} from "./stdio";

export { zodToJsonSchema } from "./zod-to-json-schema";

export { createProxiedDbClient } from "./proxied-db";

/** Props shape shared by typed View components in kit packages. */
export type ViewProps<TLoader extends (...args: any[]) => any> = {
  data: Awaited<ReturnType<TLoader>>;
};
