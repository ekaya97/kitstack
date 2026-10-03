import { pathToFileURL } from "node:url";
import { dispatchTrigger } from "@kitstackco/sdk";
import type { HttpRouteRequest, ServeHandle } from "@kitstackco/sdk/server";
import type { VoiceChannel } from "@kitstackco/voice";
import { createDemoApp, type DemoApp } from "../composition/app/index.js";
import type { McpAuthMode } from "../adapters/auth/mcp.js";
import { createBoundDebriefKit } from "../composition/kit.js";
import { createDebriefKitServer } from "../composition/host.js";
import { createDebriefVoiceChannel, type VoiceProviderOverrides } from "../composition/voice.js";
import { handleDemoAppRequest, type DemoAppRouteRequest } from "./http/app.js";
import { createScheduledCallJob, ScheduledCallPoller, type ScheduledCallPoller as ScheduledCallPollerType } from "../scheduler/index.js";
import { createScheduledTrigger } from "../triggers/index.js";

const DEFAULT_PORT = 3001;
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
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
  /** Replace only the provider network seams of the env-composed voice channel (tests). */
  liveVoiceProviders?: VoiceProviderOverrides;
  /** Optional provider-neutral scheduler seam. T-0189 supplies the live-call adapter. */
  scheduledCallPoller?: ScheduledCallPoller;
  /** Request mode rejects upgrades; daemon mode owns long-lived channel upgrades. */
  mode?: "http" | "daemon";
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
  let voice: VoiceChannel | undefined;
  const kitServer = createDebriefKitServer(app, {
    transport: "http",
    port: requestedPort,
    host: requestedHost,
    mode: mode === "daemon" ? "daemon" : "request",
    cors: { origin: "*", headers: CORS_ALLOWED_HEADERS },
    maxBodyBytes,
    // Demo control-plane routes; plugin routes (voice) are matched first.
    routes: [{ path: /^\//, handler: (request: HttpRouteRequest) => handleDemoAppRequest(app, routeRequest(request), voice) }],
  }, kit);
  // The voice agent calls kit tools through this server, so the channel is
  // created after it and mounted as a plugin.
  voice = await createDebriefVoiceChannel(app, kit, kitServer, options.liveVoiceProviders);
  if (voice) {
    // Request mode keeps the routes but refuses long-lived media upgrades.
    kitServer.use(mode === "daemon" ? voice : { routes: voice.routes, onShutdown: () => voice!.onShutdown() });
  }
  const scheduledCallPoller = options.scheduledCallPoller ?? (voice?.capabilities.phone ? createLiveVoiceScheduler(app, voice) : undefined);

  let handle: ServeHandle | undefined;
  let closed = false;
  return {
    app,
    port: requestedPort,
    get listening() { return handle !== undefined; },
    async listen() {
      if (!handle) {
        handle = await kitServer.listen();
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

function createLiveVoiceScheduler(app: DemoApp, voice: VoiceChannel): ScheduledCallPollerType {
  const scheduledTrigger = createScheduledTrigger(async (_context, payload) => {
    const session = await app.debrief.hydrateSession(payload.sessionId);
    if (session.orgId !== app.orgId) throw new Error("Scheduled call organization mismatch");
    const result = await voice.startCall(payload.sessionId);
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
