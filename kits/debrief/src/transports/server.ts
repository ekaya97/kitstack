import { pathToFileURL } from "node:url";
import { createConnectorRegistry, dispatchTrigger } from "@kitstackco/sdk";
import { CRM_CONNECTOR_KEY, type CrmClient } from "@kitstackco/crm";
import type { HttpRouteRequest, ServeHandle } from "@kitstackco/sdk/server";
import type { VoiceChannel } from "@kitstackco/voice";
import { createDemoApp, type DemoApp } from "../composition/app/index.js";
import type { McpAuthMode } from "../adapters/auth/mcp.js";
import { createBoundDebriefKit } from "../composition/kit.js";
import { createDebriefKitServer } from "../composition/host.js";
import { createDebriefVoiceChannel, type VoiceProviderOverrides } from "../composition/voice.js";
import { bindDebriefCrm } from "../composition/crm.js";
import { handleDemoAppRequest, type DemoAppRouteRequest } from "./http/app.js";
import { createScheduledCallJob, ScheduledCallPoller, type ScheduledCallPoller as ScheduledCallPollerType, type ScheduledCallPollerOptions } from "../scheduler/index.js";
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
  /** Use this CRM instead of binding one from the environment (tests, demos). */
  crm?: CrmClient;
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
    orgId: options.appOptions?.orgId ?? (process.env.KITSTACK_DEMO_ORG_ID?.trim() || undefined),
    url: options.appOptions?.url ?? readDatabaseUrl(),
    authToken: options.appOptions?.authToken ?? readDatabaseAuthToken(),
    mcpAuthMode: options.appOptions?.mcpAuthMode ?? readMcpAuthMode(process.env.KITSTACK_DEMO_MCP_AUTH),
    adminToken: options.appOptions?.adminToken ?? process.env.KITSTACK_DEMO_ADMIN_TOKEN,
    operatorFallback: options.appOptions?.operatorFallback ?? {
      orgId: process.env.KITSTACK_DEMO_ORG_ID,
      destination: process.env.KITSTACK_DEMO_ALLOWED_DESTINATION,
    },
    twilioVerify: options.appOptions?.twilioVerify ?? {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      serviceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
    },
    selfServiceDailyCallLimit: options.appOptions?.selfServiceDailyCallLimit ?? readPositiveInteger(process.env.KITSTACK_VOICE_SELF_SERVICE_DAILY_CALLS),
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
  const crm = options.crm ?? await bindDebriefCrm(app);
  let voice: VoiceChannel | undefined;
  const kitServer = createDebriefKitServer(app, {
    transport: "http",
    port: requestedPort,
    host: requestedHost,
    mode: mode === "daemon" ? "daemon" : "request",
    cors: { origin: "*", headers: CORS_ALLOWED_HEADERS },
    maxBodyBytes,
    connectors: createConnectorRegistry({ [CRM_CONNECTOR_KEY]: crm }),
    // Demo control-plane routes; plugin routes (voice) are matched first.
    routes: [{ path: /^\//, handler: (request: HttpRouteRequest) => handleDemoAppRequest(app, routeRequest(request), voice) }],
  }, kit);
  // The voice agent calls kit tools through this server, so the channel is
  // created after it and mounted as a plugin.
  voice = await createDebriefVoiceChannel(app, kit, kitServer, options.liveVoiceProviders, process.env, crm);
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
  // Organization resolution and session hydration already happened in
  // createTenantScheduledCallPoller's job handler before this trigger runs.
  const scheduledTrigger = createScheduledTrigger(async (_context, payload) => {
    const result = await voice.startCall(payload.sessionId, payload.purpose);
    return result.callId;
  });
  return createTenantScheduledCallPoller(app, async (workspace, job) => {
    const invoked = await dispatchTrigger(scheduledTrigger, {
      kitId: "kit:debrief",
      payload: { sessionId: job.sessionId, purpose: job.purpose },
      method: "INTERNAL",
      path: "/t/debrief/scheduler",
      channel: { kind: "schedule", id: scheduledTrigger.id },
      session: { id: job.sessionId, traceId: `schedule:${job.sessionId}` },
    }, {
      audit: async (event) => {
        await workspace.telemetry.append({
          id: crypto.randomUUID(), timestamp: new Date().toISOString(), orgId: workspace.orgId,
          appId: workspace.appId, sessionId: job.sessionId, traceId: `schedule:${job.sessionId}`,
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
  }, {
    workerId: process.env.KITSTACK_DEMO_SCHEDULER_WORKER_ID?.trim() || `demo-voice-${process.pid}`,
    intervalMs: Number(process.env.KITSTACK_DEMO_SCHEDULER_INTERVAL_MS ?? 1_000),
  });
}

/**
 * The host's one scheduled-call poller for every organization. Each tick runs
 * a single claim across organizations (no per-org loop, so read cost does not
 * grow with tenants); a claimed call is dispatched in its own organization's
 * workspace after its session is reloaded there.
 */
export function createTenantScheduledCallPoller(
  app: DemoApp,
  startCall: (workspace: DemoApp, job: Parameters<NonNullable<ScheduledCallPollerOptions["startCall"]>>[0]) => Promise<string | null>,
  options: Pick<ScheduledCallPollerOptions, "workerId" | "intervalMs" | "leaseMs" | "now">,
): ScheduledCallPollerType {
  return new ScheduledCallPoller({
    ...options,
    // Claims, completions and failures are org-keyed by the claimed record.
    operations: app.scheduler,
    // The declared job owns the scheduler dispatch boundary. Its provider
    // seam invokes the trigger contract, so both W5 contracts are exercised
    // by the live path without maintaining two competing callbacks.
    job: createScheduledCallJob(async (job) => {
      const workspace = await app.tenants.forOrg(job.orgId);
      const session = await workspace.debrief.hydrateSession(job.sessionId);
      if (session.orgId !== job.orgId) throw new Error("Scheduled call organization mismatch");
      return startCall(workspace, job);
    }),
    onProviderFailure: async (job, error) => {
      // A failed prebrief call must never cancel or fail the later debrief
      // call for the same session; only the primary debrief job fails the session.
      if (job.purpose === "prebrief") return;
      try {
        const workspace = await app.tenants.forOrg(job.orgId);
        await workspace.debrief.markFailed(job.sessionId, error);
      } catch { /* Keep the scheduler failure durable. */ }
    },
  });
}

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function readPositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || !/^[1-9]\d*$/.test(value.trim())) return undefined;
  return Number(value.trim());
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
