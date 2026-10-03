import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL, URL } from "node:url";
import { WebSocketServer } from "ws";
import { createDemoApp, type DemoApp } from "../composition/app/index.js";
import type { McpAuthMode } from "../adapters/auth/mcp.js";
import { createBoundDebriefKit } from "../composition/kit.js";
import { createDebriefKitServer } from "../composition/host.js";
import { handleDemoAppRequest, type DemoLiveVoiceRoute, type DemoLocalVoiceRoute, type DemoAppRouteRequest } from "./http/app.js";
import { attachVoiceMediaBridge, handleVoiceProviderStatus, startScheduledLiveVoiceCall } from "./http/voice.js";
import { composeLocalVoiceRoute } from "./local-voice.js";
import { createScheduledCallJob, ScheduledCallPoller, type ScheduledCallPoller as ScheduledCallPollerType } from "../scheduler/index.js";
import {
  createDefineAgentVoiceLoop,
  createOpenAIRealtimeSocketFactory,
  createSignedSessionTokenCodec,
  createTwilioCallsClient,
  createTwilioSignatureValidator,
  type OpenAIRealtimeSocketFactory,
  type SessionBinding,
  type VoiceWebSocket,
} from "../adapters/voice/realtime.js";
import { createDebriefVoiceTools } from "../adapters/voice/tools.js";
import { dispatchTrigger, type KitDefinition, type KitToolExecutor } from "@kitstackco/sdk";
import type { HttpRouteRequest, KitServer, ServeHandle } from "@kitstackco/sdk/server";
import { createScheduledTrigger } from "../triggers/index.js";

const DEFAULT_PORT = 3001;
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const CALL_FINALIZE_GRACE_MS = 5_000;
const CORS_ALLOWED_HEADERS = ["authorization", "content-type", "x-demo-admin-token", "x-demo-reset-token", "x-request-id", "x-session-id", "x-trace-id", "x-parent-id"];

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
  /** Replace only the provider network seams of the env-composed live route (tests). */
  liveVoiceProviders?: LiveVoiceProviderOverrides;
  /** Optional provider-neutral scheduler seam. T-0189 supplies the live-call adapter. */
  scheduledCallPoller?: ScheduledCallPoller;
  /** Request mode rejects upgrades; daemon mode owns long-lived channel upgrades. */
  mode?: "http" | "daemon";
}

export interface LiveVoiceProviderOverrides {
  openaiSocketFactory?: OpenAIRealtimeSocketFactory;
  twilioFetch?: typeof fetch;
}

export interface DemoServer {
  readonly app: DemoApp;
  /** The requested port; `listen()` returns the bound one. */
  readonly port: number;
  readonly listening: boolean;
  listen(): Promise<DemoServerAddress>;
  close(): Promise<void>;
}

export interface DemoServerAddress {
  host: string;
  port: number;
}

/**
 * The debrief host on the KitStack runtime. MCP (and View) traffic goes
 * through the SDK server and dispatch; the voice webhooks, media streams and
 * demo control-plane routes are mounted as kit-owned routes.
 *
 * Local-only by default: auth is off unless KITSTACK_DEMO_MCP_AUTH is set, so
 * a public tunnel exposes MCP. Recording and retention stay off.
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

  const mode = options.mode ?? "daemon";
  const kit = createBoundDebriefKit(app);
  // Voice agents call kit tools through the same dispatch path as MCP; the
  // server is created below, so resolve it lazily.
  let kitServer: KitServer | undefined;
  const executor: KitToolExecutor = {
    executeTool: (kitId, toolName, args, principal) => {
      if (!kitServer) throw new Error("Debrief kit server is not ready");
      return kitServer.executeTool(kitId, toolName, args, principal);
    },
  };
  const liveVoice = options.liveVoice ?? await composeLiveVoiceRoute(app, kit, executor, options.liveVoiceProviders);
  const localVoice = await composeLocalVoiceRoute(app, kit, executor);
  const scheduledCallPoller = options.scheduledCallPoller ?? (liveVoice ? createLiveVoiceScheduler(app, liveVoice) : undefined);
  const webSocketServer = new WebSocketServer({ noServer: true });
  const activeCalls = new Set<Promise<void>>();

  kitServer = createDebriefKitServer(app, {
    transport: "http",
    port: requestedPort,
    host: requestedHost,
    mode: mode === "daemon" ? "daemon" : "request",
    cors: { origin: "*", headers: CORS_ALLOWED_HEADERS },
    maxBodyBytes,
    routes: [
      ...(liveVoice ? [{
        method: "POST",
        path: "/t/voice/provider-status",
        handler: (request: HttpRouteRequest) => handleVoiceProviderStatus(routeRequest(request), liveVoice.http),
      }] : []),
      { path: /^\//, handler: (request: HttpRouteRequest) => handleDemoAppRequest(app, routeRequest(request), liveVoice, localVoice) },
    ],
    daemon: {
      onUpgrade: async ({ request, socket, head }) => {
        await handleUpgrade(request, socket as never, head, webSocketServer, mode, liveVoice, localVoice, activeCalls);
        return true;
      },
    },
    onShutdown: async () => {
      // End live media streams, then let ended calls finish persisting.
      for (const client of webSocketServer.clients) client.close(1001, "demo server shutting down");
      webSocketServer.close();
      await Promise.allSettled([...activeCalls]);
    },
  }, kit);

  let handle: ServeHandle | undefined;
  let closed = false;
  return {
    app,
    port: requestedPort,
    get listening() { return handle !== undefined; },
    async listen() {
      if (!handle) {
        handle = await kitServer!.listen();
        scheduledCallPoller?.start();
      }
      return { host: handle.host, port: handle.port };
    },
    async close() {
      if (closed) return;
      closed = true;
      scheduledCallPoller?.stop();
      if (handle) await handle.close();
      handle = undefined;
      if (ownsApp) await app.close();
    },
  };
}

function routeRequest(request: HttpRouteRequest): DemoAppRouteRequest {
  return { method: request.method, path: request.path, query: request.query, headers: request.headers, body: request.body };
}

function requestHeaders(headers: IncomingHttpHeaders): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) result[key] = Array.isArray(value) ? value[0] : value;
  return result;
}

function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function composeLiveVoiceRoute(
  app: DemoApp,
  kit: KitDefinition,
  executor: KitToolExecutor,
  providers: LiveVoiceProviderOverrides = {},
): Promise<DemoLiveVoiceRoute | undefined> {
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
  const twilioConfiguration = configured.filter(([name]) => name !== "OPENAI_API_KEY");
  if (twilioConfiguration.every(([, value]) => !value)) return undefined;
  const missing = configured.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Live voice configuration is incomplete; missing ${missing.join(", ")}`);

  const values = Object.fromEntries(configured) as Record<(typeof names)[number], string>;
  const mediaStreamUrl = requireWssUrl(values.KITSTACK_DEMO_PUBLIC_WSS_URL, "KITSTACK_DEMO_PUBLIC_WSS_URL");
  const publicHttpsUrl = requireHttpsUrl(values.KITSTACK_DEMO_PUBLIC_HTTPS_URL, "KITSTACK_DEMO_PUBLIC_HTTPS_URL");
  const destination = values.KITSTACK_DEMO_ALLOWED_DESTINATION;
  if (!/^\+[1-9]\d{7,14}$/.test(values.TWILIO_FROM_NUMBER)) throw new Error("TWILIO_FROM_NUMBER must be E.164");
  if (!/^\+[1-9]\d{7,14}$/.test(destination)) throw new Error("KITSTACK_DEMO_ALLOWED_DESTINATION must be E.164");

  const tokenCodec = createSignedSessionTokenCodec(app.apps.secret);
  const instructionsContent = readFileSync(new URL("../instructions/debrief-baseline.md", import.meta.url), "utf8");
  const baseInstructionsVersion = `sha256:${createHash("sha256").update(instructionsContent, "utf8").digest("hex")}`;
  const voiceTools = createDebriefVoiceTools(kit, executor);
  const voiceContextFor = async (binding: SessionBinding) => {
      const session = app.debrief.getSession(binding.sessionId);
      const customer = session.customerId ? await app.debrief.getCustomer(session.customerId) : null;
      const history = session.customerId ? await app.debrief.recentDebriefSummaries(session.customerId) : [];
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
        history.length ? `Previous confirmed debriefs with this customer (newest first). Refer to them and ask how the agreed next steps went:\n${history.map((entry) => `- ${entry}`).join("\n")}` : "Previous confirmed debriefs with this customer: none.",
        selected.length ? `Approved workflow feedback:\n${selected.map((record) => `- ${record.correction}`).join("\n")}` : "Approved workflow feedback: none.",
        "Use this context during the call. Ask one useful question at a time and do not invent customer details.",
        "When the caller explicitly states or agrees an outcome, next step, customer update, address, or follow-up date, call update_debrief_draft with those facts. Never call a confirmation or publish action; the operator confirms the draft after the call.",
        "When the debrief goals are covered, briefly summarise the saved facts, say goodbye, then call end_call. Also call end_call if the caller asks to end the call.",
      ].join("\n");
      return {
        content,
        version: `${baseInstructionsVersion}:voice:${createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16)}`,
        memoryIds: selected.map((record) => record.memoryId),
      };
  };
  const openai = {
    socketFactory: providers.openaiSocketFactory ?? createOpenAIRealtimeSocketFactory(),
    url: process.env.OPENAI_REALTIME_URL?.trim() || "wss://api.openai.com/v1/realtime",
    apiKey: values.OPENAI_API_KEY,
    model: process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime",
    instructions: instructionsContent,
    voice: process.env.OPENAI_REALTIME_VOICE?.trim() || "marin",
    ...(optionalNumber(process.env.OPENAI_REALTIME_VAD_THRESHOLD) !== undefined ? { vadThreshold: optionalNumber(process.env.OPENAI_REALTIME_VAD_THRESHOLD) } : {}),
    tools: voiceTools.realtime,
  };
  const conversationRoute = await app.modelRouter.resolve("conversation", {
    orgId: app.orgId,
    appId: app.appId,
    kitId: "kit:debrief",
    pluginId: "channel:voice",
  });
  const signatureValidator = createTwilioSignatureValidator(values.TWILIO_AUTH_TOKEN);

  return {
    http: {
      twilio: createTwilioCallsClient({ accountSid: values.TWILIO_ACCOUNT_SID, authToken: values.TWILIO_AUTH_TOKEN, ...(providers.twilioFetch ? { fetch: providers.twilioFetch } : {}) }),
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
        if (status.status === "failed" && status.sessionId) await app.debrief.endCallAfterInterruption(status.sessionId, `Twilio call status: ${status.rawStatus}`);
        // Safety net: the media stream normally finalizes the session when the
        // call ends. If it has not shortly after Twilio reports completion, do
        // it here so a call can never stay stuck in `calling`.
        if (status.status === "completed" && status.sessionId) {
          const sessionId = status.sessionId;
          setTimeout(() => {
            void app.debrief.endCallAfterInterruption(sessionId, "Media stream did not report the end of the call")
              .catch((error) => console.error(`[voice] could not finalize session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`));
          }, CALL_FINALIZE_GRACE_MS).unref();
        }
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
      bargeInMs: optionalNumber(process.env.KITSTACK_VOICE_BARGE_IN_MS),
      socket,
      verifier: tokenCodec,
      openai,
      routingReason: conversationRoute.reason,
      telemetry: app.telemetry,
      instructionsFor: async (binding) => (await voiceContextFor(binding)).content,
      onCallCompleted: async (call) => finalizeLiveCall(app, call),
      signature: {
        validator: signatureValidator,
        // Twilio signs the WebSocket handshake with the exact <Stream> URL (wss:).
        url: mediaStreamUrl,
        params: {},
        value: headerValue(request.headers ?? {}, "x-twilio-signature"),
      },
      agent: async (binding, provider, call) => {
        const context = await voiceContextFor(binding);
        return createDefineAgentVoiceLoop({
        sessionId: binding.sessionId,
        orgId: binding.orgId,
        appId: binding.appId,
        instructions: { version: context.version, content: context.content },
        telemetry: app.telemetry,
        provider: "twilio-openai-realtime",
        model: openai.model,
        routingReason: conversationRoute.reason,
        callId: binding.callSid ?? null,
        memoryIds: context.memoryIds,
        tools: voiceTools.agent(() => call.hangup()),
        sendToolResult: provider.sendToolResult,
        onStop: async () => { await app.debrief.awaitConfirmation(binding.sessionId); },
        onError: async (error) => { await app.debrief.endCallAfterInterruption(binding.sessionId, error); },
        });
      },
    }),
  };
}

function createLiveVoiceScheduler(app: DemoApp, liveVoice: DemoLiveVoiceRoute): ScheduledCallPollerType {
  const scheduledTrigger = createScheduledTrigger(async (_context, payload) => {
    const session = await app.debrief.hydrateSession(payload.sessionId);
    if (session.orgId !== app.orgId) throw new Error("Scheduled call organization mismatch");
    const result = await startScheduledLiveVoiceCall(payload.sessionId, liveVoice.http);
    return result.callId;
  });
  return new ScheduledCallPoller({
    operations: app.scheduler,
    orgId: app.orgId,
    workerId: process.env.KITSTACK_DEMO_SCHEDULER_WORKER_ID?.trim() || `demo-voice-${process.pid}`,
    intervalMs: Number(process.env.KITSTACK_DEMO_SCHEDULER_INTERVAL_MS ?? 1_000),
    // The declared job owns the scheduler dispatch boundary. Its provider
    // seam invokes the trigger contract, so both W5 contracts are exercised
    // by the live path without maintaining two competing callbacks.
    job: createScheduledCallJob(async (job) => {
      const invoked = await dispatchTrigger(scheduledTrigger, {
        kitId: "kit:debrief",
        payload: { sessionId: job.sessionId },
        method: "INTERNAL",
        path: "/t/debrief/scheduler",
        channel: { kind: "schedule", id: scheduledTrigger.id },
        session: { id: job.sessionId, traceId: `schedule:${job.sessionId}` },
      }, {
        audit: async (event) => {
          await app.telemetry.append({
            id: crypto.randomUUID(), timestamp: new Date().toISOString(), orgId: app.orgId,
            appId: app.appId, sessionId: job.sessionId, traceId: `schedule:${job.sessionId}`,
            channel: "trigger", pluginId: event.triggerId, kitId: "kit:debrief",
            type: "plugin.invoked", operation: "dispatch",
            outcome: event.outcome === "success" ? "success" : "error",
          });
        },
      });
      if (invoked.result.isError) {
        const block = invoked.result.content[0];
        throw new Error(block?.type === "text" ? block.text : "Scheduled trigger failed");
      }
      return invoked.value ?? null;
    }),
    onProviderFailure: async (job, error) => {
      try { await app.debrief.markFailed(job.sessionId, error); } catch { /* Keep the scheduler failure durable. */ }
    },
  });
}

async function finalizeLiveCall(
  app: DemoApp,
  call: { sessionId: string; orgId: string; callId: string | null; reason: string; occurredAt: string; provider: string },
): Promise<void> {
  const session = app.debrief.getSession(call.sessionId);
  await app.debrief.recordCallCompleted(call);
  await app.telemetry.append({
    id: crypto.randomUUID(), timestamp: call.occurredAt, orgId: call.orgId, appId: app.appId,
    customerId: session.customerId, sessionId: call.sessionId, traceId: call.sessionId,
    channel: "voice", pluginId: "kit:debrief", kitId: session.kitId, type: "voice.call",
    operation: "call_completed", provider: call.provider, callId: call.callId,
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
  mode: "http" | "daemon",
  liveVoice?: DemoLiveVoiceRoute,
  localVoice?: DemoLocalVoiceRoute,
  activeCalls?: Set<Promise<void>>,
): Promise<void> {
  const path = new URL(request.url ?? "/", "http://demo.local").pathname;
  const isTwilioVoice = path === "/t/voice/media" && liveVoice?.bridge;
  const isLocalVoice = path === "/t/voice/local/media" && localVoice?.bridge;
  if (mode !== "daemon" || (!isTwilioVoice && !isLocalVoice)) {
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
      const bridge = isLocalVoice
        ? localVoice!.bridge(ws as unknown as VoiceWebSocket)
        : liveVoice!.bridge!(ws as unknown as VoiceWebSocket, routeRequest);
      void bridge.binding.catch(() => undefined);
      const done = bridge.done.catch(() => undefined);
      activeCalls?.add(done);
      void done.finally(() => activeCalls?.delete(done));
      void bridge.done.then(() => {
        if (isLocalVoice) ws.close(1000, "local voice call complete");
      }).catch(() => undefined);
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



if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const demoServer = await createDemoServer();
  const address = await demoServer.listen();
  console.log(`KitStack demo listening at http://${address.host}:${address.port}`);
  const shutdown = () => { void demoServer.close().finally(() => process.exit(0)); };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

function optionalNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
