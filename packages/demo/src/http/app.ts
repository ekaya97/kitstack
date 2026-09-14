import type { DemoApp } from "../app/index.js";
import { handleProxyRequest } from "../proxy/index.js";
import type { DemoHttpRequest, DemoHttpResponse } from "./index.js";

const TOOLS = [
  "prepare_debrief",
  "get_session",
  "get_debrief",
  "confirm_debrief",
  "teach_from_correction",
] as const;
const JSON_HEADERS = { "content-type": "application/json" };

export interface DemoAppRouteRequest extends DemoHttpRequest {
  body?: Record<string, unknown>;
}

/** Mounts the real app composition behind framework-neutral demo routes. */
export async function handleDemoAppRequest(
  app: DemoApp,
  request: DemoAppRouteRequest,
): Promise<DemoHttpResponse> {
  const path = request.path.split("?", 1)[0];
  try {
    if (request.method === "POST" && path === "/mcp") return mcp(app, request.body ?? {});
    if (request.method === "POST" && path === "/t/voice/start") {
      const sessionId = stringField(request.body, "session_id");
      return json(200, await app.voice.start(sessionId));
    }
    if (request.method === "POST" && path === "/t/voice/status") {
      const sessionId = stringField(request.body, "session_id");
      const current = app.voice.status(sessionId);
      // The simulator's first poll represents completion of its scripted
      // German turns; subsequent polls are read-only.
      return json(200, current.status === "calling"
        ? await app.voice.advance(sessionId)
        : current);
    }
    if (request.method === "POST" && path === "/v1/apps/register") {
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
    const tokenMatch = path.match(/^\/v1\/apps\/([^/]+)\/token$/);
    if (request.method === "POST" && tokenMatch) {
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
      const result = await handleProxyRequest(proxyRequest, {
        registry: app.apps,
        telemetry: app.telemetry,
        upstream: async (upstreamRequest) => {
          const body = await upstreamRequest.clone().json() as { model?: string };
          return new Response(JSON.stringify({
            id: `demo-${crypto.randomUUID()}`,
            object: "chat.completion",
            model: body.model ?? "gpt-4o-mini",
            choices: [{ index: 0, message: { role: "assistant", content: "Demo extraction complete." }, finish_reason: "stop" }],
            usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
          }), { status: 200, headers: JSON_HEADERS });
        },
      });
      return responseFromWeb(result.response);
    }
    if (request.method === "GET" && path === "/api/demo/observability") {
      const [events, aggregate] = await Promise.all([
        app.telemetry.query({ orgId: app.orgId, ...query(request.query) }),
        app.telemetry.aggregate({ orgId: app.orgId, ...query(request.query) }),
      ]);
      return json(200, { events, aggregate });
    }
    const sessionMatch = path.match(/^\/api\/demo\/sessions\/([^/]+)$/);
    if (request.method === "GET" && sessionMatch) {
      const sessionId = decodeURIComponent(sessionMatch[1]);
      return json(200, { session: app.debrief.getSession(sessionId), events: await app.telemetry.query({ sessionId }) });
    }
    if (request.method === "POST" && path === "/api/demo/reset") {
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
  if (method === "tools/list") {
    return json(200, { jsonrpc: "2.0", id: body.id ?? null, result: {
      tools: TOOLS.map((name) => ({ name, description: `Debrief tool ${name}`, inputSchema: { type: "object" } })),
    } });
  }
  if (method !== "tools/call") return json(400, { jsonrpc: "2.0", id: body.id ?? null, error: { code: -32601, message: "Method not found" } });
  const params = (body.params && typeof body.params === "object" ? body.params : {}) as Record<string, unknown>;
  const name = stringField(params, "name");
  const args = params.arguments && typeof params.arguments === "object" ? params.arguments as Record<string, unknown> : {};
  let value: unknown;
  if (name === "prepare_debrief") value = await app.debrief.prepareDebrief(stringField(args, "goal"));
  else if (name === "get_session") value = app.debrief.getSession(stringField(args, "session_id"));
  else if (name === "get_debrief") value = app.debrief.getDebrief(stringField(args, "session_id"));
  else if (name === "teach_from_correction") value = await app.debrief.teachFromCorrection(stringField(args, "session_id"), stringField(args, "correction"));
  else if (name === "confirm_debrief") value = args.outcome === "partial"
    ? await app.debrief.markPartial(stringField(args, "session_id"))
    : await app.debrief.confirmDebrief(stringField(args, "session_id"));
  else return json(400, { jsonrpc: "2.0", id: body.id ?? null, error: { code: -32602, message: `Unknown tool ${name}` } });
  return json(200, { jsonrpc: "2.0", id: body.id ?? null, result: { content: [{ type: "text", text: JSON.stringify(value) }] } });
}

function stringField(body: Record<string, unknown> | undefined, name: string, fallback?: string): string {
  const value = body?.[name];
  if (typeof value === "string" && value.trim()) return value;
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

async function responseFromWeb(response: Response): Promise<DemoHttpResponse> {
  let body: unknown;
  try { body = await response.clone().json(); } catch { body = null; }
  return { status: response.status, headers: JSON_HEADERS, body };
}
