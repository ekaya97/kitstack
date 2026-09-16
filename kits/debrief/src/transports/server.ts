import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL, URL } from "node:url";
import { WebSocketServer } from "ws";
import { createDemoApp, type DemoApp } from "../composition/app/index.js";
import type { McpAuthMode } from "../adapters/auth/mcp.js";
import { handleDemoAppRequest, type DemoLiveVoiceRoute, type DemoAppRouteRequest } from "./http/app.js";
import { attachVoiceMediaBridge, handleVoiceProviderStatus, startScheduledLiveVoiceCall } from "./http/voice.js";
import { ScheduledCallPoller, type ScheduledCallPoller as ScheduledCallPollerType } from "../scheduler/index.js";
import {
  createDefineAgentVoiceLoop,
  createOpenAIRealtimeSocketFactory,
  createSignedSessionTokenCodec,
  createTwilioCallsClient,
  createTwilioSignatureValidator,
  type SessionBinding,
  type VoiceWebSocket,
} from "../adapters/voice/realtime.js";

const DEFAULT_PORT = 3001;
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const CORS_HEADERS = {
  "access-control-allow-headers": "authorization, content-type, x-demo-admin-token, x-demo-reset-token, x-request-id, x-session-id, x-trace-id, x-parent-id",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-origin": "*",
};

export interface DemoServerOptions {
  /** Use an ephemeral port (0) in tests. Defaults to PORT or 3001. */
  port?: number;
  /** Defaults to HOST, then 127.0.0.1. Containers should use 0.0.0.0. */
  host?: string;
  /** Keep request bodies bounded; bodies are parsed and never persisted. */
  maxBodyBytes?: number;
  /** Supplying an app transfers lifecycle ownership to the caller. */
  app?: DemoApp;
  appOptions?: Parameters<typeof createDemoApp>[0];
  /** Inject a live route in tests; otherwise it is composed from env vars. */
  liveVoice?: DemoLiveVoiceRoute;
  /** Optional provider-neutral scheduler seam. T-0189 supplies the live-call adapter. */
  scheduledCallPoller?: ScheduledCallPoller;
}

export interface DemoServer {
  readonly server: Server;
  readonly app: DemoApp;
  readonly port: number;
  listen(): Promise<DemoServerAddress>;
  close(): Promise<void>;
}

export interface DemoServerAddress {
  host: string;
  port: number;
}

/**
 * Local-only adapter for the unreleased demo. Auth is intentionally absent so
 * a public tunnel is unsafe: use it only for a controlled demo. The simulator
 * is the default voice provider and provider recording/retention stay off.
 */
export async function createDemoServer(options: DemoServerOptions = {}): Promise<DemoServer> {
  const app = options.app ?? await createDemoApp({
    ...options.appOptions,
    url: options.appOptions?.url ?? readDatabaseUrl(),
    authToken: options.appOptions?.authToken ?? readDatabaseAuthToken(),
    mcpAuthMode: options.appOptions?.mcpAuthMode ?? readMcpAuthMode(process.env.KITSTACK_DEMO_MCP_AUTH),
    adminToken: options.appOptions?.adminToken ?? process.env.KITSTACK_DEMO_ADMIN_TOKEN,
  });
  const ownsApp = options.app === undefined;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes <= 0) {
    if (ownsApp) await app.close();
    throw new Error("maxBodyBytes must be a positive integer");
  }

  const requestedPort = options.port ?? parsePort(process.env.PORT) ?? DEFAULT_PORT;
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    if (ownsApp) await app.close();
    throw new Error("port must be an integer between 0 and 65535");
  }
  const requestedHost = options.host ?? process.env.HOST ?? "127.0.0.1";
  if (!requestedHost.trim()) {
    if (ownsApp) await app.close();
    throw new Error("host must not be empty");
  }

  const liveVoice = options.liveVoice ?? await composeLiveVoiceRoute(app);
  const scheduledCallPoller = options.scheduledCallPoller ?? (liveVoice ? createLiveVoiceScheduler(app, liveVoice) : undefined);
  const webSocketServer = new WebSocketServer({ noServer: true });

  let listening = false;
  let closed = false;
  const server = createServer((request, response) => {
    void handleIncomingRequest(request, response, app, maxBodyBytes, liveVoice);
  });
  server.on("upgrade", (request, socket, head) => {
    void handleUpgrade(request, socket, head, webSocketServer, liveVoice);
  });

  return {
    server,
    app,
    port: requestedPort,
    async listen() {
      if (listening) return address(server);
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          listening = true;
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(requestedPort, requestedHost);
      });
      scheduledCallPoller?.start();
      return address(server);
    },
    async close() {
      if (closed) return;
      closed = true;
      scheduledCallPoller?.stop();
      if (listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
        });
        listening = false;
      }
      for (const client of webSocketServer.clients) client.close(1001, "demo server shutting down");
      webSocketServer.close();
      if (ownsApp) await app.close();
    },
  };
}

async function handleIncomingRequest(
  request: IncomingMessage,
  response: ServerResponse,
  app: DemoApp,
  maxBodyBytes: number,
  liveVoice?: DemoLiveVoiceRoute,
): Promise<void> {
  response.setHeader("content-type", "application/json");
  for (const [name, value] of Object.entries(CORS_HEADERS)) response.setHeader(name, value);

  if (request.method?.toUpperCase() === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  try {
    const url = new URL(request.url ?? "/", "http://demo.local");
    if (request.method?.toUpperCase() === "GET" && url.pathname === "/healthz") {
      response.statusCode = 200;
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }
    const body = await readJsonBody(request, maxBodyBytes);
    const routeRequest = {
      method: request.method ?? "GET",
      path: url.pathname,
      query: queryParams(url),
      headers: requestHeaders(request.headers),
      body,
    } satisfies DemoAppRouteRequest;
    const result = await (request.method?.toUpperCase() === "POST" && url.pathname === "/t/voice/provider-status" && liveVoice
      ? handleVoiceProviderStatus(routeRequest, liveVoice.http)
      : handleDemoAppRequest(app, routeRequest, liveVoice));
    response.statusCode = result.status;
    for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value);
    response.end(result.status === 204 ? undefined : JSON.stringify(result.body));
  } catch (error) {
    const status = error instanceof BodyTooLargeError ? 413 : 400;
    response.statusCode = status;
    response.end(JSON.stringify({ error: status === 413 ? "body_too_large" : "invalid_request", message: error instanceof Error ? error.message : String(error) }));
  }
}

async function readJsonBody(request: IncomingMessage, maxBodyBytes: number): Promise<Record<string, unknown> | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const declaredLength = Number(request.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) throw new BodyTooLargeError("request body exceeds limit");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBodyBytes) throw new BodyTooLargeError("request body exceeds limit");
    chunks.push(buffer);
  }
  if (total === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = String(request.headers["content-type"] ?? "").toLowerCase();
  const parsed: unknown = contentType.includes("application/x-www-form-urlencoded")
    ? Object.fromEntries(new URLSearchParams(raw).entries())
    : JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("request body must be a JSON object");
  return parsed as Record<string, unknown>;
}

function requestHeaders(headers: IncomingHttpHeaders): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) result[key] = Array.isArray(value) ? value[0] : value;
  return result;
}

function queryParams(url: URL): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of url.searchParams) result[key] = value;
  return result;
}

function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function composeLiveVoiceRoute(app: DemoApp): Promise<DemoLiveVoiceRoute | undefined> {
  const names = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "OPENAI_API_KEY",
    "KITSTACK_DEMO_PUBLIC_HTTPS_URL",
    "KITSTACK_DEMO_PUBLIC_WSS_URL",
    "KITSTACK_DEMO_ALLOWED_DESTINATION",
  ] as const;
  const configured = names.map((name) => [name, process.env[name]?.trim() ?? ""] as const);
  if (configured.every(([, value]) => !value)) return undefined;
  const missing = configured.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Live voice configuration is incomplete; missing ${missing.join(", ")}`);

  const values = Object.fromEntries(configured) as Record<(typeof names)[number], string>;
  const mediaStreamUrl = requireWssUrl(values.KITSTACK_DEMO_PUBLIC_WSS_URL, "KITSTACK_DEMO_PUBLIC_WSS_URL");
  const publicHttpsUrl = requireHttpsUrl(values.KITSTACK_DEMO_PUBLIC_HTTPS_URL, "KITSTACK_DEMO_PUBLIC_HTTPS_URL");
  const destination = values.KITSTACK_DEMO_ALLOWED_DESTINATION;
  if (!/^\+[1-9]\d{7,14}$/.test(values.TWILIO_FROM_NUMBER)) throw new Error("TWILIO_FROM_NUMBER must be E.164");
  if (!/^\+[1-9]\d{7,14}$/.test(destination)) throw new Error("KITSTACK_DEMO_ALLOWED_DESTINATION must be E.164");

  const tokenCodec = createSignedSessionTokenCodec(app.apps.secret);
  const instructionsContent = readFileSync(new URL("./instructions/debrief-baseline.md", import.meta.url), "utf8");
  const baseInstructionsVersion = `sha256:${createHash("sha256").update(instructionsContent, "utf8").digest("hex")}`;
  const voiceContextFor = async (binding: SessionBinding) => {
      const session = app.debrief.getSession(binding.sessionId);
      const customer = session.customerId ? await app.debrief.getCustomer(session.customerId) : null;
      const records = await app.memory.readRelevant({ orgId: session.orgId, kitId: session.kitId, ...(session.customerId ? { customerId: session.customerId } : {}), limit: 20 }, {
        orgId: session.orgId,
        appId: binding.appId,
        sessionId: session.sessionId,
        traceId: session.sessionId,
        parentId: null,
        kitId: session.kitId,
        customerId: session.customerId,
      });
      const selected = records.filter((record) => session.memoryIds.includes(record.memoryId));
      const content = [
        instructionsContent.trim(),
        "\nPrepared debrief context:",
        `Goal: ${session.goal}`,
        customer ? `Customer: ${customer.company}; contact ${customer.contactName}; location ${customer.location}` : "Customer: unavailable.",
        selected.length ? `Approved workflow feedback:\n${selected.map((record) => `- ${record.correction}`).join("\n")}` : "Approved workflow feedback: none.",
        "Use this context during the call. Ask one useful question at a time and do not invent customer details.",
      ].join("\n");
      return {
        content,
        version: `${baseInstructionsVersion}:voice:${createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16)}`,
        memoryIds: selected.map((record) => record.memoryId),
      };
  };
  const openai = {
    socketFactory: createOpenAIRealtimeSocketFactory(),
    url: process.env.OPENAI_REALTIME_URL?.trim() || "wss://api.openai.com/v1/realtime",
    apiKey: values.OPENAI_API_KEY,
    model: process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime",
    instructions: instructionsContent,
    voice: process.env.OPENAI_REALTIME_VOICE?.trim() || "marin",
  };
  const signatureValidator = createTwilioSignatureValidator(values.TWILIO_AUTH_TOKEN);

  return {
    http: {
      twilio: createTwilioCallsClient({ accountSid: values.TWILIO_ACCOUNT_SID, authToken: values.TWILIO_AUTH_TOKEN }),
      telemetry: app.telemetry,
      orgId: app.orgId,
      appId: app.appId,
      mediaStreamUrl,
      fromNumber: values.TWILIO_FROM_NUMBER,
      allowedDestinations: [destination],
      requireConfirmation: true,
      statusCallbackUrl: `${publicHttpsUrl}/t/voice/provider-status`,
      statusCallback: { validator: signatureValidator, url: `${publicHttpsUrl}/t/voice/provider-status` },
      resolveSessionIdForCallId: async (callId) => {
        const job = (await app.scheduler.list(app.orgId)).find((candidate) => candidate.providerCallId === callId);
        return job?.sessionId ?? null;
      },
      onProviderStatus: async (status) => {
        await app.telemetry.append({
          id: crypto.randomUUID(), timestamp: new Date().toISOString(), orgId: app.orgId, appId: app.appId,
          sessionId: status.sessionId, traceId: status.sessionId, channel: "voice", kitId: "kit:debrief",
          type: "voice.call", operation: `provider_status.${status.status}`, provider: "twilio-openai-realtime",
          callId: status.callId, outcome: status.status === "failed" ? "error" : "success",
        });
        if (status.status === "failed" && status.sessionId) await app.debrief.markFailed(status.sessionId, `Twilio call status: ${status.rawStatus}`);
      },
      onCallCompleted: async (call) => finalizeLiveCall(app, call),
      beforeStart: async (sessionId) => { await app.debrief.markCalling(sessionId); },
      onProviderStart: async (sessionId, callId) => { await app.debrief.setCallId(sessionId, callId); },
      onFailure: async (sessionId, error) => { await app.debrief.markFailed(sessionId, error); },
      sessionTokenFor: async (sessionId) => {
        const session = app.debrief.getSession(sessionId);
        if (session.state !== "calling") throw new Error("Live voice session is not calling");
        return tokenCodec.sign({ sessionId, orgId: session.orgId, appId: app.appId });
      },
    },
    capability: { enabled: true, provider: "twilio-openai-realtime", model: openai.model, startPath: "/t/voice/live/start" },
    requireAdminToken: true,
    bridge: (socket, request) => attachVoiceMediaBridge({
      socket,
      verifier: tokenCodec,
      openai,
      telemetry: app.telemetry,
      instructionsFor: async (binding) => (await voiceContextFor(binding)).content,
      onCallCompleted: async (call) => finalizeLiveCall(app, call),
      signature: {
        validator: signatureValidator,
        url: `${publicHttpsUrl}/t/voice/media`,
        params: {},
        value: headerValue(request.headers ?? {}, "x-twilio-signature"),
      },
      agent: async (binding) => {
        const context = await voiceContextFor(binding);
        return createDefineAgentVoiceLoop({
        sessionId: binding.sessionId,
        orgId: binding.orgId,
        appId: binding.appId,
        instructions: { version: context.version, content: context.content },
        telemetry: app.telemetry,
        provider: "twilio-openai-realtime",
        model: openai.model,
        callId: binding.callSid ?? null,
        memoryIds: context.memoryIds,
        onStop: async () => { await app.debrief.awaitConfirmation(binding.sessionId); },
        onError: async (error) => { await app.debrief.markFailed(binding.sessionId, error); },
        });
      },
    }),
  };
}

function createLiveVoiceScheduler(app: DemoApp, liveVoice: DemoLiveVoiceRoute): ScheduledCallPollerType {
  return new ScheduledCallPoller({
    operations: app.scheduler,
    orgId: app.orgId,
    workerId: process.env.KITSTACK_DEMO_SCHEDULER_WORKER_ID?.trim() || `demo-voice-${process.pid}`,
    intervalMs: Number(process.env.KITSTACK_DEMO_SCHEDULER_INTERVAL_MS ?? 1_000),
    startCall: async (job) => {
      // The session is read from DebriefService's durable hydration, not a
      // process-local voice context, before the provider seam is invoked.
      const session = await app.debrief.hydrateSession(job.sessionId);
      if (session.orgId !== job.orgId) throw new Error("Scheduled call organization mismatch");
      const result = await startScheduledLiveVoiceCall(job.sessionId, liveVoice.http);
      return result.callId;
    },
    onProviderFailure: async (job, error) => {
      try { await app.debrief.markFailed(job.sessionId, error); } catch { /* Keep the scheduler failure durable. */ }
    },
  });
}

async function finalizeLiveCall(
  app: DemoApp,
  call: { sessionId: string; orgId: string; callId: string | null; reason: string; occurredAt: string },
): Promise<void> {
  const session = app.debrief.getSession(call.sessionId);
  await app.debrief.recordCallCompleted(call);
  await app.telemetry.append({
    id: crypto.randomUUID(), timestamp: call.occurredAt, orgId: call.orgId, appId: app.appId,
    customerId: session.customerId, sessionId: call.sessionId, traceId: call.sessionId,
    channel: "voice", pluginId: "kit:debrief", kitId: session.kitId, type: "voice.call",
    operation: "call_completed", provider: "twilio-openai-realtime", callId: call.callId,
    outcome: "success",
  });
}

function requireWssUrl(value: string, name: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a valid URL`); }
  if (url.protocol !== "wss:") throw new Error(`${name} must use wss:`);
  return value.replace(/\/$/, "");
}

function requireHttpsUrl(value: string, name: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a valid URL`); }
  if (url.protocol !== "https:") throw new Error(`${name} must use https:`);
  return value.replace(/\/$/, "");
}

async function handleUpgrade(
  request: IncomingMessage,
  socket: NodeJS.WritableStream & { destroy(): void; write(data: string): boolean },
  head: Buffer,
  webSocketServer: WebSocketServer,
  liveVoice?: DemoLiveVoiceRoute,
): Promise<void> {
  const path = new URL(request.url ?? "/", "http://demo.local").pathname;
  if (!liveVoice?.bridge || path !== "/t/voice/media") {
    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  webSocketServer.handleUpgrade(request, socket as never, head, (ws) => {
    const routeRequest: DemoAppRouteRequest = {
      method: "GET",
      path,
      headers: requestHeaders(request.headers),
    };
    try {
      const bridge = liveVoice.bridge!(ws as unknown as VoiceWebSocket, routeRequest);
      void bridge.binding.catch(() => undefined);
      void bridge.done.catch(() => undefined);
    } catch (error) {
      ws.close(1011, error instanceof Error ? error.message : "bridge setup failed");
    }
  });
}

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function readDatabaseUrl(): string | undefined {
  const value = process.env.KITSTACK_DEMO_DB_URL?.trim() || process.env.TURSO_DB_URL?.trim();
  return value || undefined;
}

function readDatabaseAuthToken(): string | undefined {
  const value = process.env.KITSTACK_DEMO_DB_AUTH_TOKEN?.trim() || process.env.TURSO_AUTH_TOKEN?.trim();
  return value || undefined;
}

function readMcpAuthMode(value: string | undefined): McpAuthMode {
  if (value === undefined || value === "") return "none";
  if (value === "none" || value === "app-token" || value === "internal-signed") return value;
  throw new Error("KITSTACK_DEMO_MCP_AUTH must be none, app-token, or internal-signed");
}

function address(server: Server): DemoServerAddress {
  const value = server.address();
  if (value === null || typeof value === "string") throw new Error("demo server is not listening on a TCP port");
  return { host: value.address, port: value.port };
}

class BodyTooLargeError extends Error {}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const demoServer = await createDemoServer();
  const address = await demoServer.listen();
  console.log(`KitStack demo listening at http://${address.host}:${address.port}`);
  const shutdown = () => { void demoServer.close().finally(() => process.exit(0)); };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
