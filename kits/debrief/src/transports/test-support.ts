import type { ConnectorRegistry } from "@kitstackco/sdk";
import { createDebriefKitServer, authenticateDebriefMcp } from "../composition/host.js";
import type { DemoApp } from "../composition/app/index.js";
import type { DemoAppRouteRequest } from "./http/app.js";
import type { DemoHttpResponse } from "./http/index.js";

const JSON_HEADERS = { "content-type": "application/json" };

/** In-process MCP client for tests: the same SDK protocol, auth and dispatch as the HTTP host. */
export async function mcpRequest(
  app: DemoApp,
  request: Pick<DemoAppRouteRequest, "headers" | "body">,
  options: { connectors?: ConnectorRegistry } = {},
): Promise<DemoHttpResponse> {
  const headers = Object.fromEntries(Object.entries(request.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]));
  const auth = await authenticateDebriefMcp(app, { headers });
  if ("status" in auth) return { status: auth.status, headers: { ...JSON_HEADERS, ...(auth.headers ?? {}) }, body: auth.body };
  const server = createDebriefKitServer(app, { transport: "http", ...(options.connectors ? { connectors: options.connectors } : {}) });
  const response = await server.protocol.handleRequest({ jsonrpc: "2.0", ...request.body } as never, auth.userId);
  return response ? { status: 200, headers: JSON_HEADERS, body: response } : { status: 202, headers: {}, body: null };
}

/** `tools/call` params for a debrief tool through the KitStack `kit` tool. */
export function kitCall(cmd: string, params: Record<string, unknown>) {
  return { name: "kit", arguments: { id: "debrief", cmd, params } };
}

/** `tools/call` params that load a debrief View's data (the shell is not needed in tests). */
export function kitView(view: string, params?: Record<string, unknown>) {
  return { name: "kit", arguments: { id: "debrief", cmd: "__load_view", params: { view, ...(params ? { params } : {}) } } };
}
