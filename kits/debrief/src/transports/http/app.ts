import type { DemoApp } from "../../composition/app/index.js";
import { authenticateDebriefMcp } from "../../composition/host.js";
import type { McpAuthMode } from "../../adapters/auth/mcp.js";
import type { DemoHttpRequest, DemoHttpResponse } from "./index.js";
import type { VoiceChannel, VoiceChannelCapability } from "@kitstackco/voice";
import type { ProxyResult } from "../../adapters/proxy/index.js";
import type { ScheduledCallRecord } from "../../scheduler/index.js";
import type { TelemetryAggregate, TelemetryEvent } from "../../telemetry/index.js";
import type { VoiceStatusResult } from "../../adapters/voice/index.js";

const JSON_HEADERS = { "content-type": "application/json" };

export interface DemoAppRouteRequest extends DemoHttpRequest {
  body?: Record<string, unknown>;
}

export interface DemoObservabilityCustomer {
  id: string;
  company: string;
  contactName: string;
}

export interface DemoObservabilitySession {
  sessionId: string;
  customerId: string | null;
  customerName: string | null;
  appId: string | null;
  kitId: string | null;
  state: string;
  scheduledCallAt: string | null;
  callId: string | null;
  lastEventAt: string | null;
  error: string | null;
}

export interface DemoProviderHealth {
  provider: string;
  status: "healthy" | "degraded" | "idle";
  eventCount: number;
  errorCount: number;
  lastEventAt: string | null;
  recentFailures: Array<{ timestamp: string; operation: string; sessionId: string | null }>;
}

export interface DemoObservabilityResponse {
  events: TelemetryEvent[];
  aggregate: TelemetryAggregate;
  plugins: Array<{ id: string; kind: string; version: string; status: string }>;
  apps: ReturnType<DemoApp["apps"]["list"]>;
  kits: Array<{ id: string; version: string; status: string }>;
  schedulerJobs: ScheduledCallRecord[];
  sessions: DemoObservabilitySession[];
  customers: DemoObservabilityCustomer[];
  providerHealth: DemoProviderHealth[];
  mcpAuthMode: McpAuthMode;
  liveCall?: VoiceChannelCapability;
  localCall?: VoiceChannelCapability;
}

/** Mounts the real app composition behind framework-neutral demo routes. */
export async function handleDemoAppRequest(
  app: DemoApp,
  request: DemoAppRouteRequest,
  voice?: Pick<VoiceChannel, "capabilities">,
): Promise<DemoHttpResponse> {
  const path = request.path.split("?", 1)[0];
  try {
    await app.plugins.dispatch("http:demo-routes", {
      method: request.method,
      path,
    }, pluginContext(app, request, bodySessionId(request.body)));
    if (request.method === "POST" && path === "/t/voice/start") {
      if (!await readerAuthorized(app, request)) return json(401, { error: "unauthorized" });
      const sessionId = stringField(request.body, "session_id");
      return json(200, await app.plugins.dispatch("trigger:voice-http", { operation: "start", sessionId }, pluginContext(app, request, sessionId)));
    }
    if (request.method === "POST" && path === "/t/voice/status") {
      if (!await readerAuthorized(app, request)) return json(401, { error: "unauthorized" });
      const sessionId = stringField(request.body, "session_id");
      const current = await app.plugins.dispatch<{ operation: string; sessionId: string }, VoiceStatusResult>("channel:voice", { operation: "status", sessionId }, pluginContext(app, request, sessionId));
      // The simulator's first poll represents completion of its scripted
      // German turns; subsequent polls are read-only.
      return json(200, current.status === "calling"
        ? await app.plugins.dispatch<{ operation: string; sessionId: string }, VoiceStatusResult>("channel:voice", { operation: "advance", sessionId }, pluginContext(app, request, sessionId))
        : current);
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
      if (!await readerAuthorized(app, request)) return json(401, { error: "unauthorized" });
      return json(200, await observabilitySnapshot(app, query(request.query), voice));
    }
    const sessionMatch = path.match(/^\/api\/demo\/sessions\/([^/]+)$/);
    if (request.method === "GET" && sessionMatch) {
      if (!await readerAuthorized(app, request)) return json(401, { error: "unauthorized" });
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

function query(values: DemoHttpRequest["query"]): {
  appId?: string | null;
  customerId?: string;
  sessionId?: string;
  pluginId?: string;
  kitId?: string;
  from?: string;
  to?: string;
  limit?: number;
} {
  const result: {
    appId?: string | null;
    customerId?: string;
    sessionId?: string;
    pluginId?: string;
    kitId?: string;
    from?: string;
    to?: string;
    limit?: number;
  } = {};
  if (values?.appId !== undefined) result.appId = values.appId === "null" ? null : values.appId;
  if (values?.customerId !== undefined) result.customerId = values.customerId;
  if (values?.sessionId !== undefined) result.sessionId = values.sessionId;
  if (values?.pluginId !== undefined) result.pluginId = values.pluginId;
  if (values?.kitId !== undefined) result.kitId = values.kitId;
  if (values?.from !== undefined) result.from = values.from;
  if (values?.to !== undefined) result.to = values.to;
  if (values?.limit !== undefined && Number.isFinite(Number(values.limit))) result.limit = Number(values.limit);
  return result;
}

async function observabilitySnapshot(
  app: DemoApp,
  filters: ReturnType<typeof query>,
  voice?: Pick<VoiceChannel, "capabilities">,
): Promise<DemoObservabilityResponse> {
  const [events, aggregate, schedulerJobs] = await Promise.all([
    app.telemetry.query({ orgId: app.orgId, ...filters }),
    app.telemetry.aggregate({ orgId: app.orgId, ...filters }),
    app.scheduler.list(app.orgId),
  ]);
  const sessions = [...new Set(events.map((event) => event.sessionId).filter((id): id is string => Boolean(id)))];
  const customerIds = [...new Set(events.map((event) => event.customerId).filter((id): id is string => Boolean(id)))];
  const customers = (await Promise.all(customerIds.map(async (id) => {
    const customer = await app.debrief.getCustomer(id);
    return customer ? { id, company: customer.company, contactName: customer.contactName } : null;
  }))).filter((customer): customer is DemoObservabilityCustomer => Boolean(customer));
  const plugins = app.plugins.list().map((plugin) => ({ id: plugin.id, kind: plugin.kind, version: plugin.version, status: "ready" }));
  const kits = plugins.filter((plugin) => plugin.kind === "kit").map((plugin) => ({ id: plugin.id.replace(/^kit:/, ""), version: plugin.version, status: plugin.status }));
  const sessionRows = sessions.map((sessionId) => {
    const sessionEvents = events.filter((event) => event.sessionId === sessionId);
    const latest = sessionEvents.at(-1);
    let persistedSession: ReturnType<DemoApp["debrief"]["getSession"]> | undefined;
    try { persistedSession = app.debrief.getSession(sessionId); } catch { /* Boot/HTTP trace sessions have no debrief row. */ }
    const customerId = [...sessionEvents].reverse().find((event) => event.customerId)?.customerId ?? null;
    const customer = customerId ? customers.find((item) => item.id === customerId) : undefined;
    const job = schedulerJobs.find((item) => item.sessionId === sessionId);
    const failure = [...sessionEvents].reverse().find((event) => event.outcome === "error");
    return {
      sessionId,
      customerId,
      customerName: customer?.company ?? null,
      appId: [...sessionEvents].reverse().find((event) => event.appId)?.appId ?? null,
      kitId: [...sessionEvents].reverse().find((event) => event.kitId)?.kitId ?? null,
      state: persistedSession?.state ?? sessionState(sessionEvents, job?.status),
      scheduledCallAt: job?.scheduledAt ?? null,
      callId: persistedSession?.callId ?? [...sessionEvents].reverse().find((event) => event.callId)?.callId ?? job?.providerCallId ?? null,
      lastEventAt: latest?.timestamp ?? null,
      error: failure?.operation ?? job?.error ?? null,
    };
  });
  return {
    events,
    aggregate,
    plugins,
    apps: app.apps.list(),
    kits,
    schedulerJobs,
    sessions: sessionRows,
    customers,
    providerHealth: providerHealth(events),
    mcpAuthMode: app.mcpAuthMode,
    ...(voice?.capabilities.phone ? { liveCall: voice.capabilities.phone } : {}),
    ...(voice?.capabilities.local ? { localCall: voice.capabilities.local } : {}),
  };
}

function sessionState(events: Array<{ operation: string; outcome: string }>, scheduledStatus?: string): string {
  const latest = events.at(-1);
  if (latest?.outcome === "error") return "failed";
  if (latest?.operation === "complete" || latest?.operation === "confirmed") return "confirmed";
  if (latest?.operation === "await_confirmation") return "awaiting_confirmation";
  if (latest?.operation === "start" || latest?.operation === "calling") return "calling";
  return scheduledStatus === "scheduled" ? "scheduled" : "active";
}

function providerHealth(events: TelemetryEvent[]): DemoProviderHealth[] {
  const providers = new Map<string, TelemetryEvent[]>();
  for (const event of events) {
    const provider = event.provider ?? (event.channel === "voice" ? "simulator" : null);
    if (!provider) continue;
    const current = providers.get(provider) ?? [];
    current.push(event);
    providers.set(provider, current);
  }
  if (!providers.has("simulator")) providers.set("simulator", []);
  return [...providers].map(([provider, providerEvents]) => {
    const failures = providerEvents.filter((event) => event.outcome === "error").slice(-3).reverse();
    return {
      provider,
      status: failures.length ? "degraded" : providerEvents.length ? "healthy" : "idle",
      eventCount: providerEvents.length,
      errorCount: providerEvents.filter((event) => event.outcome === "error").length,
      lastEventAt: providerEvents.at(-1)?.timestamp ?? null,
      recentFailures: failures.map((event) => ({ timestamp: event.timestamp, operation: event.operation, sessionId: event.sessionId ?? null })),
    };
  });
}

function json<T>(status: number, body: T): DemoHttpResponse<T> { return { status, headers: JSON_HEADERS, body }; }

/**
 * Telemetry, session and simulator routes carry customer data. They need the
 * operator's admin token or the router's signed service token, never neither.
 */
async function readerAuthorized(app: DemoApp, request: DemoAppRouteRequest): Promise<boolean> {
  if (adminAuthorized(app, request)) return true;
  if (app.mcpAuthMode !== "internal-signed") return false;
  return !("status" in await authenticateDebriefMcp(app, { headers: request.headers ?? {} }));
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

