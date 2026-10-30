import type { IncomingMessage } from "node:http";
import { WebSocketServer } from "ws";
import type { AgentToolDefinition } from "@kitstackco/sdk";
import type { DaemonUpgrade, HttpRoute, HttpRouteRequest, HttpRouteResponse, ServerPlugin } from "@kitstackco/sdk/server";
import {
  createDefineAgentVoiceLoop,
  createOpenAIRealtimeSocketFactory,
  createSignedSessionTokenCodec,
  createTwilioCallsClient,
  createTwilioSignatureValidator,
  type OpenAIRealtimeSocketFactory,
  type RealtimeFunctionTool,
  type SessionBinding,
  type VoiceTelemetrySink,
  type VoiceWebSocket,
} from "./realtime.js";
import {
  attachVoiceMediaBridge,
  handleLiveVoiceStart,
  handleVoiceProviderStatus,
  startScheduledLiveVoiceCall,
  type CompletedCallMetadata,
  type LiveVoiceHttpOptions,
  type VoiceHttpResponse,
} from "./http.js";
import { localVoicePage } from "./local-page.js";

export const VOICE_PATHS = {
  phoneStart: "/t/voice/live/start",
  phoneStatus: "/t/voice/provider-status",
  phoneMedia: "/t/voice/media",
  localPage: "/t/voice/local",
  localStart: "/t/voice/local/start",
  localMedia: "/t/voice/local/media",
} as const;

const PHONE_PROVIDER = "twilio-openai-realtime";
const LOCAL_PROVIDER = "local-openai-realtime";
const DEFAULT_FINALIZE_GRACE_MS = 5_000;
const E164 = /^\+[1-9]\d{7,14}$/;

/** The call a briefing and the session hooks are about. */
export interface VoiceCall {
  sessionId: string;
  orgId: string;
  appId: string | null;
  callId: string | null;
  channel: "phone" | "local";
}

/** Per-call instructions for the model. The content is never persisted. */
export interface VoiceCallBriefing {
  content: string;
  version: string;
  memoryIds?: readonly string[];
}

/** The kit's session state machine; the channel calls these at each step of a call. */
export interface VoiceSessionHooks {
  /** Move the session into "calling" and return its identity for the media token. Throw to refuse. */
  startSession(sessionId: string, channel: VoiceCall["channel"]): Promise<{ orgId: string; appId: string | null }>;
  onCallStarted?(sessionId: string, callId: string): Promise<void>;
  onStartFailed?(sessionId: string, error: unknown): Promise<void>;
  /** The agent finished normally: it hung up, or the caller did. */
  onAgentFinished(sessionId: string): Promise<void>;
  /** The call ended by error, or without a clean end of the media stream. */
  onCallInterrupted(sessionId: string, reason: unknown): Promise<void>;
  /** Provider-neutral completion metadata, once per media stream. */
  onCallCompleted?(call: CompletedCallMetadata): Promise<void>;
  /** Map a provider call id back to a session, for status callbacks. */
  resolveSessionIdForCallId?(callId: string): Promise<string | null>;
}

export interface VoicePhoneOptions {
  accountSid: string;
  authToken: string;
  /** Caller ID in E.164. */
  fromNumber: string;
  /** Public https base URL that reaches this server (Twilio webhooks and media). */
  publicUrl: string;
  /** Only these E.164 numbers can be called. */
  allowedDestinations: readonly string[];
  /** Guard for the start route, e.g. an operator token. Defaults to deny. */
  authorizeStart?: (request: HttpRouteRequest) => boolean;
  /** Test seam for the Twilio REST API. */
  fetch?: typeof fetch;
}

export interface VoiceRealtimeOptions {
  apiKey: string;
  model?: string;
  voice?: string;
  url?: string;
  /** Server VAD threshold (0-1). */
  vadThreshold?: number;
  /** Silence after speech before the agent answers. */
  silenceDurationMs?: number;
  /** Audio kept from before the detected start of speech. */
  prefixPaddingMs?: number;
  /** Why this model was chosen, for telemetry. */
  routingReason?: string | null;
  /** Test seam for the OpenAI Realtime socket. */
  socketFactory?: OpenAIRealtimeSocketFactory;
}

export interface VoiceChannelOptions {
  /** Kit the calls belong to, e.g. "kit:debrief". */
  kitId: string;
  agentId?: string;
  /** Organisation for events that are not yet bound to a session (provider status). */
  orgId?: string;
  telemetry: VoiceTelemetrySink;
  /** Signs the short-lived media session token; at least 32 bytes. */
  sessionSecret: string | Uint8Array;
  realtime: VoiceRealtimeOptions;
  /** Real phone calls through Twilio. Omit to disable. */
  phone?: VoicePhoneOptions;
  /** Browser-microphone test page at /t/voice/local. */
  localHarness?: boolean;
  /** Build the model's per-call instructions. */
  briefing(call: VoiceCall): Promise<VoiceCallBriefing>;
  /** Kit tools for the agent (e.g. from kitAgentTools); end_call is added by the channel. */
  tools: { realtime: readonly RealtimeFunctionTool[]; agent: readonly AgentToolDefinition[] };
  sessions: VoiceSessionHooks;
  /** How long the caller must talk over the agent before it stops; defaults to the VAD silence duration plus 100 ms. */
  bargeInMs?: number;
  /** Upper bound between the agent's hang-up request and the line dropping. */
  hangupTimeoutMs?: number;
  /** Grace period before a completed call without a clean stream end is finalised. */
  finalizeGraceMs?: number;
}

export interface VoiceChannelCapability {
  enabled: true;
  provider: string;
  model: string;
  startPath: string;
  mediaPath?: string;
}

/** A KitStack server plugin: mount it with `server.use(channel)`. */
export interface VoiceChannel extends ServerPlugin {
  /** HTTP routes: phone start and status callback, local harness page and start. */
  readonly routes: readonly HttpRoute[];
  /** Media-stream upgrade handler. */
  onUpgrade(upgrade: DaemonUpgrade): Promise<boolean>;
  /** Place a phone call to the first allowed destination (schedulers). */
  startCall(sessionId: string): Promise<{ callId: string }>;
  /** End live media streams and wait until ended calls are persisted. */
  onShutdown(): Promise<void>;
  readonly capabilities: { phone?: VoiceChannelCapability; local?: VoiceChannelCapability };
}

export const END_CALL_TOOL: RealtimeFunctionTool = {
  type: "function",
  name: "end_call",
  description: "End the phone call. Use it only after the conversation is complete: you have saved the agreed facts, briefly summarised them, and said goodbye. The line drops after your next sentence finishes playing.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
};

/** Lets the agent end the call; the bridge decides when the line actually drops. */
export function createEndCallTool(hangup: () => void): AgentToolDefinition {
  return {
    name: "end_call",
    description: "End the phone call after the conversation is complete and the caller has been told goodbye.",
    execute: async () => {
      hangup();
      return { status: "ending", instruction: "Say one short goodbye sentence if you have not already. Do not ask further questions." };
    },
  };
}

/**
 * A voice channel for a kit: real phone calls (Twilio + OpenAI Realtime) and
 * a local browser-microphone harness, with call control, hang-up, barge-in
 * handling and metadata-only telemetry. The kit supplies the briefing, its
 * tools and its session hooks; recording and retention stay off.
 */
export function createVoiceChannel(options: VoiceChannelOptions): VoiceChannel {
  const tokenCodec = createSignedSessionTokenCodec(options.sessionSecret);
  const model = options.realtime.model ?? "gpt-realtime";
  const realtime = {
    socketFactory: options.realtime.socketFactory ?? createOpenAIRealtimeSocketFactory(),
    url: options.realtime.url ?? "wss://api.openai.com/v1/realtime",
    apiKey: options.realtime.apiKey,
    model,
    ...(options.realtime.voice ? { voice: options.realtime.voice } : {}),
    ...(options.realtime.vadThreshold !== undefined ? { vadThreshold: options.realtime.vadThreshold } : {}),
    ...(options.realtime.silenceDurationMs !== undefined ? { silenceDurationMs: options.realtime.silenceDurationMs } : {}),
    ...(options.realtime.prefixPaddingMs !== undefined ? { prefixPaddingMs: options.realtime.prefixPaddingMs } : {}),
    tools: [...options.tools.realtime, END_CALL_TOOL],
  };
  const sockets = new WebSocketServer({ noServer: true });
  const activeCalls = new Set<Promise<void>>();
  const now = () => new Date().toISOString();

  const telemetry = (event: Record<string, unknown>) => options.telemetry.append({
    id: crypto.randomUUID(), timestamp: now(), channel: "voice", kitId: options.kitId, type: "voice.call",
    ...event,
  } as never);

  /** Briefings are built once per call and shared by session setup and the agent loop. */
  const briefings = new Map<string, Promise<VoiceCallBriefing>>();
  const briefingFor = (binding: SessionBinding, channel: VoiceCall["channel"]) => {
    let briefing = briefings.get(binding.sessionId);
    if (!briefing) {
      briefing = options.briefing({ sessionId: binding.sessionId, orgId: binding.orgId, appId: binding.appId, callId: binding.callSid ?? null, channel });
      briefings.set(binding.sessionId, briefing);
    }
    return briefing;
  };

  const bridgeFor = (channel: VoiceCall["channel"], socket: VoiceWebSocket, signature?: { url: string; value: string | undefined }) => {
    const provider = channel === "phone" ? PHONE_PROVIDER : LOCAL_PROVIDER;
    const validator = options.phone ? createTwilioSignatureValidator(options.phone.authToken) : undefined;
    const bridge = attachVoiceMediaBridge({
      socket,
      kitId: options.kitId,
      verifier: tokenCodec,
      openai: realtime,
      provider,
      ...(channel === "local" ? { stopReason: "local_stop" } : {}),
      routingReason: options.realtime.routingReason ?? null,
      telemetry: options.telemetry,
      bargeInMs: options.bargeInMs,
      hangupTimeoutMs: options.hangupTimeoutMs,
      ...(signature && validator ? { signature: { validator, url: signature.url, params: {}, value: signature.value } } : {}),
      instructionsFor: async (binding) => (await briefingFor(binding, channel)).content,
      onCallCompleted: async (call) => {
        briefings.delete(call.sessionId);
        await options.sessions.onCallCompleted?.(call);
      },
      agent: async (binding, session, call) => {
        const briefing = await briefingFor(binding, channel);
        return createDefineAgentVoiceLoop({
          sessionId: binding.sessionId,
          orgId: binding.orgId,
          appId: binding.appId,
          kitId: options.kitId,
          agentId: options.agentId,
          instructions: { version: briefing.version, content: briefing.content },
          telemetry: options.telemetry,
          provider,
          model,
          routingReason: options.realtime.routingReason ?? null,
          callId: binding.callSid ?? null,
          memoryIds: briefing.memoryIds ?? [],
          tools: [...options.tools.agent, createEndCallTool(() => call.hangup())],
          sendToolResult: session.sendToolResult,
          onStop: async () => { await options.sessions.onAgentFinished(binding.sessionId); },
          onError: async (error) => {
            console.error(`[voice] ${channel} call ${binding.sessionId} failed: ${error.message}`);
            await options.sessions.onCallInterrupted(binding.sessionId, error);
          },
        });
      },
    });
    void bridge.binding.catch(() => undefined);
    const done = bridge.done.catch(() => undefined);
    activeCalls.add(done);
    void done.finally(() => activeCalls.delete(done));
    if (channel === "local") void done.then(() => socket.close(1000, "local voice call complete"));
    return bridge;
  };

  const phone = options.phone ? composePhone(options.phone) : undefined;

  function composePhone(config: VoicePhoneOptions) {
    const publicUrl = requireUrl(config.publicUrl, "https:", "phone.publicUrl").replace(/\/$/, "");
    if (!E164.test(config.fromNumber)) throw new Error("phone.fromNumber must be E.164");
    if (!config.allowedDestinations.length || config.allowedDestinations.some((number) => !E164.test(number))) {
      throw new Error("phone.allowedDestinations must list E.164 numbers");
    }
    const mediaStreamUrl = `${publicUrl.replace(/^https:/, "wss:")}${VOICE_PATHS.phoneMedia}`;
    const statusUrl = `${publicUrl}${VOICE_PATHS.phoneStatus}`;
    const finalizeGraceMs = options.finalizeGraceMs ?? DEFAULT_FINALIZE_GRACE_MS;
    const claims = new Map<string, { orgId: string; appId: string | null }>();
    // Calls this channel placed, so status callbacks resolve without the kit's help.
    const callSessions = new Map<string, string>();
    const http: LiveVoiceHttpOptions = {
      twilio: createTwilioCallsClient({ accountSid: config.accountSid, authToken: config.authToken, ...(config.fetch ? { fetch: config.fetch } : {}) }),
      telemetry: options.telemetry,
      kitId: options.kitId,
      orgId: options.orgId ?? "unknown",
      appId: null,
      sessionIdentity: (sessionId) => claims.get(sessionId),
      mediaStreamUrl,
      fromNumber: config.fromNumber,
      allowedDestinations: config.allowedDestinations,
      requireConfirmation: true,
      statusCallbackUrl: statusUrl,
      statusCallback: { validator: createTwilioSignatureValidator(config.authToken), url: statusUrl },
      resolveSessionIdForCallId: async (callId) =>
        callSessions.get(callId) ?? await options.sessions.resolveSessionIdForCallId?.(callId) ?? null,
      beforeStart: async (sessionId) => { claims.set(sessionId, await options.sessions.startSession(sessionId, "phone")); },
      sessionTokenFor: async (sessionId) => {
        const identity = claims.get(sessionId);
        if (!identity) throw new Error("Voice session was not started");
        return tokenCodec.sign({ sessionId, ...identity });
      },
      onProviderStart: async (sessionId, callId) => {
        claims.delete(sessionId);
        callSessions.set(callId, sessionId);
        await options.sessions.onCallStarted?.(sessionId, callId);
      },
      onFailure: async (sessionId, error) => { claims.delete(sessionId); await options.sessions.onStartFailed?.(sessionId, error); },
      onProviderStatus: async (status) => {
        await telemetry({
          orgId: options.orgId ?? "unknown", sessionId: status.sessionId, traceId: status.sessionId,
          operation: `provider_status.${status.status}`, provider: PHONE_PROVIDER, callId: status.callId,
          outcome: status.status === "failed" ? "error" : "success",
        });
        if (status.status === "completed" || status.status === "failed") callSessions.delete(status.callId);
        if (!status.sessionId) return;
        const sessionId = status.sessionId;
        if (status.status === "failed") await options.sessions.onCallInterrupted(sessionId, `Twilio call status: ${status.rawStatus}`);
        // Safety net: the media stream normally finishes the call. If it has
        // not shortly after Twilio reports completion, finish it here so a
        // session can never stay in "calling".
        if (status.status === "completed") {
          setTimeout(() => {
            void options.sessions.onCallInterrupted(sessionId, "Media stream did not report the end of the call")
              .catch((error) => console.error(`[voice] could not finalize session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`));
          }, finalizeGraceMs).unref();
        }
      },
    };
    return { config, http, mediaStreamUrl };
  }

  const routes: HttpRoute[] = [];
  if (phone) {
    routes.push(
      {
        method: "POST",
        path: VOICE_PATHS.phoneStart,
        handler: async (request) => {
          if (!(phone.config.authorizeStart?.(request) ?? false)) return { status: 403, body: { error: "start_not_authorized" } };
          return toRouteResponse(await handleLiveVoiceStart(voiceRequest(request, VOICE_PATHS.phoneStart), phone.http));
        },
      },
      {
        method: "POST",
        path: VOICE_PATHS.phoneStatus,
        handler: async (request) => toRouteResponse(await handleVoiceProviderStatus(voiceRequest(request, VOICE_PATHS.phoneStatus), phone.http)),
      },
    );
  }
  if (options.localHarness) {
    routes.push(
      {
        method: "GET",
        path: VOICE_PATHS.localPage,
        handler: () => ({ status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: localVoicePage({ startPath: VOICE_PATHS.localStart }) }),
      },
      {
        method: "POST",
        path: VOICE_PATHS.localStart,
        handler: async (request) => {
          const sessionId = typeof request.body?.session_id === "string" ? request.body.session_id : "";
          if (!sessionId) return { status: 400, body: { error: "session_id is required" } };
          if (request.body?.confirmation !== true) return { status: 400, body: { error: "confirmation_required" } };
          const identity = await options.sessions.startSession(sessionId, "local");
          const callId = `local-${crypto.randomUUID()}`;
          await options.sessions.onCallStarted?.(sessionId, callId);
          return {
            status: 202,
            body: {
              sessionId,
              callId,
              status: "connecting",
              provider: LOCAL_PROVIDER,
              sessionToken: await tokenCodec.sign({ sessionId, ...identity }),
              mediaPath: VOICE_PATHS.localMedia,
              recording: false,
              retention: false,
            },
          };
        },
      },
    );
  }

  return {
    routes,
    capabilities: {
      ...(phone ? { phone: { enabled: true, provider: PHONE_PROVIDER, model, startPath: VOICE_PATHS.phoneStart } } : {}),
      ...(options.localHarness ? { local: { enabled: true, provider: LOCAL_PROVIDER, model, startPath: VOICE_PATHS.localStart, mediaPath: VOICE_PATHS.localMedia } } : {}),
    },
    async onUpgrade({ request, socket, head }) {
      const path = new URL(request.url ?? "/", "http://voice.local").pathname;
      const channel = path === VOICE_PATHS.phoneMedia && phone ? "phone" : path === VOICE_PATHS.localMedia && options.localHarness ? "local" : undefined;
      if (!channel) return false;
      sockets.handleUpgrade(request, socket as never, head, (ws) => {
        try {
          bridgeFor(channel, ws as unknown as VoiceWebSocket, channel === "phone"
            // Twilio signs the WebSocket handshake with the exact <Stream> URL (wss:).
            ? { url: phone!.mediaStreamUrl, value: header(request, "x-twilio-signature") }
            : undefined);
        } catch (error) {
          ws.close(1011, error instanceof Error ? error.message : "bridge setup failed");
        }
      });
      return true;
    },
    async startCall(sessionId) {
      if (!phone) throw new Error("Phone calls are not configured");
      const result = await startScheduledLiveVoiceCall(sessionId, phone.http);
      return { callId: result.callId };
    },
    async onShutdown() {
      for (const client of sockets.clients) client.close(1001, "server shutting down");
      sockets.close();
      await Promise.allSettled([...activeCalls]);
    },
  };
}

function voiceRequest(request: HttpRouteRequest, path: string) {
  return { method: request.method, path, headers: request.headers, body: request.body };
}

function toRouteResponse(response: VoiceHttpResponse): HttpRouteResponse {
  return { status: response.status, headers: { ...response.headers }, body: response.body };
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function requireUrl(value: string, protocol: string, name: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a valid URL`); }
  if (url.protocol !== protocol) throw new Error(`${name} must use ${protocol}`);
  return value;
}
