import type { DemoApp } from "../app/index.js";
import { authenticateMcpRequest, McpAuthError } from "../auth/mcp.js";
import type { DemoHttpRequest, DemoHttpResponse } from "./index.js";
import { handleLiveVoiceStart, type LiveVoiceHttpOptions } from "./voice.js";
import type { TwilioOpenAIBridge, VoiceWebSocket } from "../voice/realtime.js";
import type { ProxyResult } from "../proxy/index.js";
import type { VoiceStatusResult } from "../voice/index.js";

const JSON_HEADERS = { "content-type": "application/json" };
const MCP_SERVER_INFO = { name: "kitstack-demo", version: "0.1.0" };
const MCP_PROTOCOL_VERSION = "2025-11-25";
const MCP_TOOLS = [
  {
    name: "prepare_debrief",
    description: "Prepare a sales debrief using current instructions and approved memories.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "The outcome to achieve in the sales debrief." },
        company: { type: "string", description: "The customer company." },
        contact_name: { type: "string", description: "The customer contact." },
        location: { type: "string", description: "The meeting or customer location." },
        callback_at: { type: "string", description: "When the phone should ring: ISO timestamp or HH:mm." },
        callback_timezone: { type: "string", description: "IANA timezone for callback_at, for example Europe/Berlin." },
        buffer_minutes: { type: "number", description: "Optional delay after callback_at before starting the call." },
      },
      required: ["goal", "company", "contact_name", "location", "callback_at", "callback_timezone"],
    },
  },
  {
    name: "get_session",
    description: "Read the complete state of a prepared debrief session.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"] },
  },
  {
    name: "get_debrief",
    description: "Read the compact status summary for a debrief session.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"] },
  },
  {
    name: "confirm_debrief",
    description: "Confirm a completed debrief, or record a partial outcome.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" }, outcome: { type: "string", enum: ["confirmed", "partial"] } }, required: ["session_id", "outcome"] },
  },
  {
    name: "teach_from_correction",
    description: "Store operator feedback as a candidate memory for a later run.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" }, correction: { type: "string" } }, required: ["session_id", "correction"] },
  },
  {
    name: "approve_memory",
    description: "Approve a candidate memory taught during this debrief.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" }, memory_id: { type: "string" } }, required: ["session_id", "memory_id"] },
  },
  {
    name: "publish_memory",
    description: "Publish an approved memory so a later debrief can retrieve it.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" }, memory_id: { type: "string" } }, required: ["session_id", "memory_id"] },
  },
  {
    name: "start_voice_call",
    description: "Start the deterministic German sales voice call for a prepared debrief.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"] },
  },
  {
    name: "get_voice_status",
    description: "Poll the sales voice call until it reaches confirmation.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"] },
  },
] as const;

export interface DemoAppRouteRequest extends DemoHttpRequest {
  body?: Record<string, unknown>;
}

export interface DemoLiveVoiceRoute {
  http: LiveVoiceHttpOptions;
  capability: { enabled: true; provider: string; model: string; startPath: string };
  /** Real phone calls always require the operator token, even in loopback auth-none mode. */
  requireAdminToken?: boolean;
  bridge?: (socket: VoiceWebSocket, request: DemoAppRouteRequest) => TwilioOpenAIBridge;
}

/** Mounts the real app composition behind framework-neutral demo routes. */
export async function handleDemoAppRequest(
  app: DemoApp,
  request: DemoAppRouteRequest,
  liveVoice?: DemoLiveVoiceRoute,
): Promise<DemoHttpResponse> {
  const path = request.path.split("?", 1)[0];
  try {
    await app.plugins.dispatch("http:demo-routes", {
      method: request.method,
      path,
    }, pluginContext(app, request, bodySessionId(request.body)));
    if (request.method === "POST" && path === "/mcp") {
      try {
        await authenticateMcpRequest(new Request("http://demo.local/mcp", {
          method: "POST",
          headers: toHeaders(request.headers),
        }), { mode: app.mcpAuthMode, registry: app.apps });
      } catch (error) {
        return mcpAuthResponse(error);
      }
      return mcp(app, request.body ?? {});
    }
    if (request.method === "POST" && path === "/t/voice/start") {
      const sessionId = stringField(request.body, "session_id");
      return json(200, await app.plugins.dispatch("trigger:voice-http", { operation: "start", sessionId }, pluginContext(app, request, sessionId)));
    }
    if (request.method === "POST" && path === "/t/voice/status") {
      const sessionId = stringField(request.body, "session_id");
      const current = await app.plugins.dispatch<{ operation: string; sessionId: string }, VoiceStatusResult>("channel:voice", { operation: "status", sessionId }, pluginContext(app, request, sessionId));
      // The simulator's first poll represents completion of its scripted
      // German turns; subsequent polls are read-only.
      return json(200, current.status === "calling"
        ? await app.plugins.dispatch<{ operation: string; sessionId: string }, VoiceStatusResult>("channel:voice", { operation: "advance", sessionId }, pluginContext(app, request, sessionId))
        : current);
    }
    if (request.method === "POST" && path === "/t/voice/live/start") {
      if (!liveVoice) return json(404, { error: "live_voice_disabled" });
      if (!adminAuthorized(app, request) || (liveVoice.requireAdminToken && readHeader(request.headers, "x-demo-admin-token") !== app.adminToken)) {
        return json(403, { error: "admin_token_required" });
      }
      return responseFromVoice(await handleLiveVoiceStart(request, liveVoice.http));
    }
    if (request.method === "POST" && path === "/v1/apps/register") {
      if (!adminAuthorized(app, request)) return json(403, { error: "admin_token_required" });
      const body = request.body ?? {};
      const registered = app.apps.register({
        name: stringField(body, "name"),
        org: stringField(body, "org", app.orgId),
        scopes: arrayField(body, "scopes"),
      });
      await app.telemetry.append({
        id: crypto.randomUUID(), timestamp: new Date().toISOString(), orgId: registered.org,
        appId: registered.id, channel: "system", type: "app.registered", operation: "register",
        outcome: "success",
      });
      return json(201, registered);
    }
    if (request.method === "GET" && path === "/v1/apps") {
      if (!adminAuthorized(app, request)) return json(403, { error: "admin_token_required" });
      return json(200, { apps: app.apps.list() });
    }
    const tokenMatch = path.match(/^\/v1\/apps\/([^/]+)\/token$/);
    if (request.method === "POST" && tokenMatch) {
      if (!adminAuthorized(app, request)) return json(403, { error: "admin_token_required" });
      const appId = decodeURIComponent(tokenMatch[1]);
      const token = await app.apps.issue(appId);
      const registered = app.apps.get(appId);
      if (!registered) return json(404, { error: "app_not_found" });
      await app.telemetry.append({
        id: crypto.randomUUID(), timestamp: new Date().toISOString(), orgId: registered.org,
        appId, channel: "system", type: "app.token_issued", operation: "issue",
        outcome: "success",
      });
      return json(200, { appId, token, expiresInSeconds: app.apps.tokenTtlSeconds });
    }
    if (request.method === "POST" && path === "/v1/chat/completions") {
      const proxyRequest = new Request("http://demo.local/v1/chat/completions", {
        method: "POST",
        headers: toHeaders(request.headers),
        body: JSON.stringify(request.body ?? {}),
      });
      const result = await app.plugins.dispatch<{ request: Request }, ProxyResult>("proxy:demo-openai-compatible", { request: proxyRequest }, pluginContext(app, request, request.body?.session_id as string | undefined));
      return responseFromWeb(result.response);
    }
    if (request.method === "GET" && path === "/api/demo/observability") {
      const [events, aggregate] = await Promise.all([
        app.telemetry.query({ orgId: app.orgId, ...query(request.query) }),
        app.telemetry.aggregate({ orgId: app.orgId, ...query(request.query) }),
      ]);
      return json(200, {
        events,
        aggregate,
        plugins: app.plugins.list().map((plugin) => ({
          id: plugin.id,
          kind: plugin.kind,
          version: plugin.version,
          status: "ready",
        })),
        mcpAuthMode: app.mcpAuthMode,
        ...(liveVoice ? { liveCall: liveVoice.capability } : {}),
      });
    }
    const sessionMatch = path.match(/^\/api\/demo\/sessions\/([^/]+)$/);
    if (request.method === "GET" && sessionMatch) {
      const sessionId = decodeURIComponent(sessionMatch[1]);
      return json(200, { session: app.debrief.getSession(sessionId), events: await app.telemetry.query({ sessionId }) });
    }
    if (request.method === "POST" && path === "/api/demo/reset") {
      if (!adminAuthorized(app, request)) return json(403, { error: "admin_token_required" });
      if (readHeader(request.headers, "x-demo-reset-token") !== "demo-reset") {
        return json(403, { error: "reset_forbidden" });
      }
      await app.reset();
      return json(200, { ok: true, cleared: ["sessions", "memory", "telemetry"], preserved: ["app_registry", "token_registry"] });
    }
    return json(404, { error: "not_found" });
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function mcp(app: DemoApp, body: Record<string, unknown>): Promise<DemoHttpResponse> {
  const method = typeof body.method === "string" ? body.method : "tools/list";
  if (method === "initialize") {
    return json(200, { jsonrpc: "2.0", id: body.id ?? null, result: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: MCP_SERVER_INFO,
    } });
  }
  if (method === "notifications/initialized") return { status: 204, headers: {}, body: null };
  if (method === "ping") return json(200, { jsonrpc: "2.0", id: body.id ?? null, result: {} });
  if (method === "tools/list") {
    return json(200, { jsonrpc: "2.0", id: body.id ?? null, result: {
      tools: MCP_TOOLS,
    } });
  }
  if (method !== "tools/call") return json(400, { jsonrpc: "2.0", id: body.id ?? null, error: { code: -32601, message: "Method not found" } });
  const params = (body.params && typeof body.params === "object" ? body.params : {}) as Record<string, unknown>;
  const name = stringField(params, "name");
  const args = params.arguments && typeof params.arguments === "object" ? params.arguments as Record<string, unknown> : {};
  let value: unknown;
  if (name === "prepare_debrief") {
    // Keep the local simulator's goal-only shortcut while advertising the
    // presenter contract above. Claude and the router use the rich branch.
    const hasPresenterFields = ["company", "contact_name", "location", "callback_at", "callback_timezone", "buffer_minutes"]
      .some((field) => args[field] !== undefined);
    value = hasPresenterFields
      ? await kitDispatch(app, {
        operation: "prepare",
        goal: stringField(args, "goal"),
        company: stringField(args, "company"),
        contactName: stringField(args, "contact_name"),
        location: stringField(args, "location"),
        callbackAt: stringField(args, "callback_at"),
        callbackTimezone: stringField(args, "callback_timezone"),
        bufferMinutes: numberField(args, "buffer_minutes", 0),
      }, args)
      : await kitDispatch(app, { operation: "prepare", goal: stringField(args, "goal") }, args);
  }
  else if (name === "get_session") value = await kitDispatch(app, { operation: "get_session", sessionId: stringField(args, "session_id") }, args);
  else if (name === "get_debrief") value = await kitDispatch(app, { operation: "get_debrief", sessionId: stringField(args, "session_id") }, args);
  else if (name === "teach_from_correction") value = await kitDispatch(app, { operation: "teach", sessionId: stringField(args, "session_id"), correction: stringField(args, "correction") }, args);
  else if (name === "approve_memory") value = await kitDispatch(app, { operation: "approve", sessionId: stringField(args, "session_id"), memoryId: stringField(args, "memory_id") }, args);
  else if (name === "publish_memory") value = await kitDispatch(app, { operation: "publish", sessionId: stringField(args, "session_id"), memoryId: stringField(args, "memory_id") }, args);
  else if (name === "start_voice_call") value = await app.plugins.dispatch("trigger:voice-http", { operation: "start", sessionId: stringField(args, "session_id") }, pluginContext(app, undefined, stringField(args, "session_id")));
  else if (name === "get_voice_status") {
    const sessionId = stringField(args, "session_id");
    const current = await app.plugins.dispatch<{ operation: string; sessionId: string }, VoiceStatusResult>("channel:voice", { operation: "status", sessionId }, pluginContext(app, undefined, sessionId));
    value = current.status === "calling" ? await app.plugins.dispatch<{ operation: string; sessionId: string }, VoiceStatusResult>("channel:voice", { operation: "advance", sessionId }, pluginContext(app, undefined, sessionId)) : current;
  }
  else if (name === "confirm_debrief") {
    const sessionId = stringField(args, "session_id");
    value = await app.plugins.dispatch("trigger:voice-http", {
      operation: "complete",
      sessionId,
      outcome: args.outcome === "partial" ? "partial" : "confirmed",
    }, pluginContext(app, undefined, sessionId));
  }
  else return json(400, { jsonrpc: "2.0", id: body.id ?? null, error: { code: -32602, message: `Unknown tool ${name}` } });
  return json(200, { jsonrpc: "2.0", id: body.id ?? null, result: { content: [{ type: "text", text: JSON.stringify(value) }] } });
}

async function kitDispatch(
  app: DemoApp,
  input: Record<string, unknown>,
  args: Record<string, unknown>,
): Promise<unknown> {
  const sessionId = typeof input.sessionId === "string" ? input.sessionId : undefined;
  return app.plugins.dispatch("kit:debrief", input, pluginContext(app, undefined, sessionId ?? (typeof args.session_id === "string" ? args.session_id : undefined)));
}

function bodySessionId(body: Record<string, unknown> | undefined): string | undefined {
  return typeof body?.session_id === "string" ? body.session_id : undefined;
}

function pluginContext(app: DemoApp, request?: DemoAppRouteRequest, sessionId?: string) {
  const headers = request?.headers ?? {};
  const read = (name: string) => Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
  const stableSessionId = sessionId ?? read("x-session-id") ?? `http-${crypto.randomUUID()}`;
  return {
    orgId: app.orgId,
    appId: app.appId,
    sessionId: stableSessionId,
    traceId: read("x-trace-id") ?? stableSessionId,
    parentId: read("x-parent-id") ?? null,
    telemetry: app.telemetry,
  };
}

function stringField(body: Record<string, unknown> | undefined, name: string, fallback?: string): string {
  const value = body?.[name];
  if (typeof value === "string" && value.trim()) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`${name} is required`);
}

function numberField(body: Record<string, unknown> | undefined, name: string, fallback?: number): number {
  const value = body?.[name];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`${name} is required`);
}

function arrayField(body: Record<string, unknown>, name: string): string[] | undefined {
  return Array.isArray(body[name]) ? body[name].filter((value): value is string => typeof value === "string") : undefined;
}

function readHeader(headers: DemoHttpRequest["headers"], name: string): string | undefined {
  return Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];
}

function toHeaders(headers: DemoHttpRequest["headers"]): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers ?? {})) if (value !== undefined) result.set(key, value);
  result.set("content-type", "application/json");
  return result;
}

function query(values: DemoHttpRequest["query"]): { appId?: string | null; sessionId?: string; limit?: number } {
  const result: { appId?: string | null; sessionId?: string; limit?: number } = {};
  if (values?.appId !== undefined) result.appId = values.appId === "null" ? null : values.appId;
  if (values?.sessionId !== undefined) result.sessionId = values.sessionId;
  if (values?.limit !== undefined && Number.isFinite(Number(values.limit))) result.limit = Number(values.limit);
  return result;
}

function json<T>(status: number, body: T): DemoHttpResponse<T> { return { status, headers: JSON_HEADERS, body }; }

function mcpAuthResponse(error: unknown): DemoHttpResponse {
  if (!(error instanceof McpAuthError)) return json(500, { error: "mcp_auth_misconfigured" });
  const status = error.code === "insufficient_scope" ? 403 : error.code === "misconfigured" ? 500 : 401;
  return {
    status,
    headers: status === 401 ? { ...JSON_HEADERS, "www-authenticate": "Bearer" } : JSON_HEADERS,
    body: { error: error.code, message: error.message },
  };
}

function adminAuthorized(app: DemoApp, request: DemoAppRouteRequest): boolean {
  if (app.mcpAuthMode === "none") return true;
  return readHeader(request.headers, "x-demo-admin-token") === app.adminToken;
}

async function responseFromWeb(response: Response): Promise<DemoHttpResponse> {
  let body: unknown;
  try { body = await response.clone().json(); } catch { body = null; }
  return { status: response.status, headers: JSON_HEADERS, body };
}

function responseFromVoice(response: { status: number; headers: Readonly<Record<string, string>>; body: unknown }): DemoHttpResponse {
  return { status: response.status, headers: response.headers, body: response.body };
}
