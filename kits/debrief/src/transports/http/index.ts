import {
  DemoResetGuardError,
  type DemoRequestContext,
  type DemoRuntime,
  type DemoRuntimeRequest,
} from "../../runtime/index.js";
import type {
  TelemetryChannel,
  TelemetryEventType,
  TelemetryQuery,
} from "../../plugins/telemetry/index.js";

export interface DemoHttpRequest extends DemoRuntimeRequest {
  method: string;
  path: string;
  query?: Readonly<Record<string, string | undefined>>;
  body?: unknown;
}

export interface DemoHttpResponse<T = unknown> {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: T;
}

export interface DemoRouteDefinition {
  method: "GET" | "POST";
  path: string;
  handler: DemoRouteHandler;
}

export type DemoRouteHandler = (
  request: DemoHttpRequest,
  context: DemoRequestContext,
  params: Readonly<Record<string, string>>,
) => Promise<DemoHttpResponse>;

const JSON_HEADERS = { "content-type": "application/json" };

/** Route definitions are plain data plus functions, so any HTTP server can mount them. */
export function createDemoRouteDefinitions(runtime: DemoRuntime): DemoRouteDefinition[] {
  return [
    {
      method: "POST",
      path: "/mcp",
      handler: async () => response(501, {
        error: "mcp_not_implemented",
        message: "The isolated demo MCP transport is not implemented yet",
      }),
    },
    {
      method: "POST",
      path: "/api/demo/reset",
      handler: async (request) => {
        await runtime.reset(readHeader(request.headers, "x-demo-reset-token"));
        return response(200, {
          ok: true,
          cleared: ["telemetry_events"],
          preserved: ["app_registry", "token_registry"],
        });
      },
    },
    {
      method: "GET",
      path: "/api/demo/observability",
      handler: async (request) => response(200, await runtime.queryObservability(toTelemetryQuery(request.query))),
    },
    {
      method: "GET",
      path: "/api/demo/sessions/:id",
      handler: async (request, _context, params) => response(
        200,
        await runtime.querySession(params.id, toTelemetryQuery(request.query)),
      ),
    },
  ];
}

/** Dispatch one request through the route table without choosing a web framework. */
export async function handleDemoRequest(
  runtime: DemoRuntime,
  request: DemoHttpRequest,
): Promise<DemoHttpResponse> {
  const route = createDemoRouteDefinitions(runtime).find((candidate) => {
    return candidate.method === request.method.toUpperCase() && matchPath(candidate.path, request.path);
  });
  if (!route) return response(404, { error: "not_found" });

  const context = runtime.createRequestContext(request);
  try {
    return await route.handler(request, context, extractParams(route.path, request.path));
  } catch (error) {
    if (error instanceof DemoResetGuardError) {
      return response(403, { error: "reset_forbidden", message: error.message });
    }
    throw error;
  }
}

function response<T>(status: number, body: T): DemoHttpResponse<T> {
  return { status, headers: JSON_HEADERS, body };
}

function readHeader(
  headers: DemoHttpRequest["headers"],
  name: string,
): string | undefined {
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === name && value !== undefined) return value;
  }
  return undefined;
}

function matchPath(pattern: string, path: string): boolean {
  const patternParts = splitPath(pattern);
  const pathParts = splitPath(path);
  return patternParts.length === pathParts.length && patternParts.every((part, index) => {
    return part.startsWith(":") || part === pathParts[index];
  });
}

function extractParams(pattern: string, path: string): Record<string, string> {
  const params: Record<string, string> = {};
  const patternParts = splitPath(pattern);
  const pathParts = splitPath(path);
  patternParts.forEach((part, index) => {
    if (part.startsWith(":")) params[part.slice(1)] = decodeURIComponent(pathParts[index]);
  });
  return params;
}

function splitPath(path: string): string[] {
  return path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

function toTelemetryQuery(
  query: DemoHttpRequest["query"],
): TelemetryQuery {
  const values = query ?? {};
  const result: TelemetryQuery = {};
  if (values.orgId !== undefined) result.orgId = values.orgId;
  if (values.appId !== undefined) result.appId = values.appId === "null" ? null : values.appId;
  if (values.sessionId !== undefined) result.sessionId = values.sessionId;
  if (values.traceId !== undefined) result.traceId = values.traceId;
  if (values.parentId !== undefined) result.parentId = values.parentId === "null" ? null : values.parentId;
  if (values.type !== undefined) result.type = values.type as TelemetryEventType;
  if (values.channel !== undefined) result.channel = values.channel as TelemetryChannel;
  if (values.from !== undefined) result.from = values.from;
  if (values.to !== undefined) result.to = values.to;
  if (values.limit !== undefined) {
    const limit = Number(values.limit);
    if (Number.isFinite(limit)) result.limit = limit;
  }
  return result;
}
