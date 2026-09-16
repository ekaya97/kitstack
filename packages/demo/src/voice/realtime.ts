import { createHmac, timingSafeEqual } from "node:crypto";
import WebSocket from "ws";
import { defineAgent, type AgentInput, type AgentLifecycleEvent, type AgentRunResult } from "@kitstackco/sdk";
import { jwtVerify, SignJWT } from "jose";
import type { TelemetryEventInput, TelemetryStore } from "../telemetry/index.js";

export const REALTIME_AUDIO_FORMAT = "g711_ulaw" as const;
export const REALTIME_SAMPLE_RATE_HZ = 8_000 as const;
export const REALTIME_PROVIDER = "twilio-openai-realtime" as const;

export interface TwilioCallRequest {
  to: string;
  from: string;
  twiml: string;
  statusCallbackUrl?: string;
  /** Explicitly disables Twilio recording. */
  record: false;
}

export interface TwilioCallResponse {
  sid: string;
  status?: string;
}

/** Small REST seam; tests and alternate telephony providers can inject a fake. */
export interface TwilioCallsClient {
  createCall(request: TwilioCallRequest): Promise<TwilioCallResponse>;
}

export interface TwilioClientOptions {
  accountSid: string;
  authToken: string;
  apiBaseUrl?: string;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

/**
 * Server-side Twilio Calls API client. Credentials never enter telemetry or
 * a browser-facing response. The client deliberately sends Record=false.
 */
export function createTwilioCallsClient(options: TwilioClientOptions): TwilioCallsClient {
  const accountSid = required(options.accountSid, "Twilio account SID");
  const authToken = required(options.authToken, "Twilio auth token");
  const apiBaseUrl = (options.apiBaseUrl ?? "https://api.twilio.com").replace(/\/$/, "");
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new Error("A fetch implementation is required for Twilio calls");

  return {
    async createCall(request) {
      const endpoint = `${apiBaseUrl}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls.json`;
      const body = new URLSearchParams({
        To: request.to,
        From: request.from,
        Twiml: request.twiml,
        Record: "false",
      });
      if (request.statusCallbackUrl) body.set("StatusCallback", request.statusCallbackUrl);
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (!response.ok) {
        let detail = "";
        try {
          const errorPayload = await response.clone().json() as { code?: unknown; message?: unknown; more_info?: unknown };
          const code = typeof errorPayload.code === "string" || typeof errorPayload.code === "number" ? String(errorPayload.code) : "";
          const message = typeof errorPayload.message === "string" ? errorPayload.message : "";
          if (code || message) detail = ` (${[code, message].filter(Boolean).join(": ")})`;
        } catch {
          // Preserve the stable HTTP error when Twilio returns a non-JSON body.
        }
        throw new Error(`Twilio Calls API returned HTTP ${response.status}${detail}`);
      }
      const payload = await response.json() as { sid?: unknown; status?: unknown };
      if (typeof payload.sid !== "string" || !payload.sid) throw new Error("Twilio Calls API returned no call SID");
      return { sid: payload.sid, status: typeof payload.status === "string" ? payload.status : undefined };
    },
  };
}

export interface TwimlOptions {
  mediaStreamUrl: string;
  sessionToken: string;
}

/** Generates the only TwiML accepted by the live demo: a bidirectional stream. */
export function generateBidirectionalStreamTwiml(options: TwimlOptions): string {
  const streamUrl = requireUrl(options.mediaStreamUrl, "wss:", "media stream URL");
  const token = required(options.sessionToken, "session token");
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<Response>",
    "  <Connect>",
    `    <Stream url=\"${xmlEscape(streamUrl)}\">`,
    `      <Parameter name=\"kitstack_session_token\" value=\"${xmlEscape(token)}\"/>`,
    "    </Stream>",
    "  </Connect>",
    "</Response>",
  ].join("\n");
}

export interface SignedSessionClaims {
  sessionId: string;
  orgId: string;
  appId: string | null;
}

/** Verification is injected so the demo can use its existing signed-session implementation. */
export interface SignedSessionTokenVerifier {
  verify(token: string): Promise<SignedSessionClaims>;
}

/** Short-lived internal token carried in Twilio Stream custom parameters. */
export interface SignedSessionTokenCodec extends SignedSessionTokenVerifier {
  sign(claims: SignedSessionClaims): Promise<string>;
}

export function createSignedSessionTokenCodec(secret: Uint8Array | string, now: () => number = Date.now): SignedSessionTokenCodec {
  const key = typeof secret === "string" ? new TextEncoder().encode(secret) : secret;
  if (key.byteLength < 32) throw new Error("Signed session token secret must be at least 32 bytes");
  return {
    sign(claims) {
      return new SignJWT({ orgId: claims.orgId, appId: claims.appId })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(claims.sessionId)
        .setExpirationTime(Math.floor(now() / 1000) + 10 * 60)
        .sign(key);
    },
    async verify(token) {
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"], currentDate: new Date(now()) });
      if (typeof payload.sub !== "string" || typeof payload.orgId !== "string" || (typeof payload.appId !== "string" && payload.appId !== null)) {
        throw new Error("Invalid signed session token claims");
      }
      return { sessionId: payload.sub, orgId: payload.orgId, appId: payload.appId };
    },
  };
}

export interface TwilioSignatureInput {
  url: string;
  params: Readonly<Record<string, string | string[] | undefined>>;
  signature: string | undefined;
}

export interface TwilioSignatureValidator {
  validate(input: TwilioSignatureInput): boolean;
}

/** Twilio's documented HMAC-SHA1 signature algorithm, kept behind a seam. */
export function createTwilioSignatureValidator(authToken: string): TwilioSignatureValidator {
  const token = required(authToken, "Twilio auth token");
  return {
    validate(input) {
      if (!input.signature) return false;
      const suffix = Object.keys(input.params).sort().map((key) => `${key}${valueForSignature(input.params[key])}`).join("");
      const expected = createHmac("sha1", token).update(`${input.url}${suffix}`).digest("base64");
      const actual = Buffer.from(input.signature);
      const expectedBuffer = Buffer.from(expected);
      return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
    },
  };
}

export interface OpenAIRealtimeSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: "open" | "message" | "close" | "error", listener: (...args: any[]) => void): this;
  once(event: "open" | "message" | "close" | "error", listener: (...args: any[]) => void): this;
  off?(event: "open" | "message" | "close" | "error", listener: (...args: any[]) => void): this;
}

export interface OpenAIRealtimeConnectOptions {
  url: string;
  apiKey: string;
  model: string;
}

export interface OpenAIRealtimeSocketFactory {
  connect(options: OpenAIRealtimeConnectOptions): Promise<OpenAIRealtimeSocket>;
}

/** Concrete server-side OpenAI Realtime WebSocket factory. */
export function createOpenAIRealtimeSocketFactory(): OpenAIRealtimeSocketFactory {
  return {
    connect(options) {
      const url = requireUrl(options.url, "wss:", "OpenAI Realtime URL");
      const apiKey = required(options.apiKey, "OpenAI API key");
      const model = required(options.model, "OpenAI Realtime model");
      const socket = new WebSocket(`${url}${url.includes("?") ? "&" : "?"}model=${encodeURIComponent(model)}`, {
        headers: {
          authorization: `Bearer ${apiKey}`,
          "openai-beta": "realtime=v1",
        },
      });
      return new Promise((resolve, reject) => {
        const onError = (error: Error) => { socket.off("open", onOpen); reject(error); };
        const onOpen = () => { socket.off("error", onError); resolve(socket); };
        socket.once("error", onError);
        socket.once("open", onOpen);
      });
    },
  };
}

export interface RealtimeSessionOptions {
  socketFactory: OpenAIRealtimeSocketFactory;
  url: string;
  apiKey: string;
  model: string;
  instructions?: string;
  voice?: string;
}

export interface OpenAIRealtimeSession {
  socket: OpenAIRealtimeSocket;
  sendAudio(payload: string): void;
  cancelResponse(): void;
  close(): void;
}

/** Opens a model session and sends the privacy/audio-format setup before media. */
export async function createOpenAIRealtimeSession(options: RealtimeSessionOptions): Promise<OpenAIRealtimeSession> {
  const socket = await options.socketFactory.connect({ url: options.url, apiKey: options.apiKey, model: options.model });
  socket.send(JSON.stringify({
    type: "session.update",
    session: {
      modalities: ["audio", "text"],
      ...(options.instructions ? { instructions: options.instructions } : {}),
      ...(options.voice ? { voice: options.voice } : {}),
      input_audio_format: REALTIME_AUDIO_FORMAT,
      output_audio_format: REALTIME_AUDIO_FORMAT,
      turn_detection: { type: "server_vad", create_response: true, interrupt_response: true },
    },
  }));
  // Outbound calls need an explicit first response; otherwise server VAD
  // waits for the callee to speak before the agent ever greets them.
  socket.send(JSON.stringify({ type: "response.create", response: { modalities: ["audio"] } }));
  return {
    socket,
    sendAudio(payload) { socket.send(JSON.stringify({ type: "input_audio_buffer.append", audio: payload })); },
    cancelResponse() { socket.send(JSON.stringify({ type: "response.cancel" })); },
    close() { socket.close(1000, "kitstack call complete"); },
  };
}

export interface RealtimeCallStartOptions {
  sessionId: string;
  orgId: string;
  appId: string | null;
  to: string;
  from: string;
  mediaStreamUrl: string;
  sessionToken: string;
  twilio: TwilioCallsClient;
  telemetry: Pick<TelemetryStore, "append">;
  statusCallbackUrl?: string;
  now?: () => string;
  createId?: () => string;
}

export interface RealtimeCallBoundary {
  callId: string;
  sessionId: string;
  provider: typeof REALTIME_PROVIDER;
  status: "connecting";
  media: { transport: "twilio-media-streams"; direction: "bidirectional"; audioFormat: typeof REALTIME_AUDIO_FORMAT; sampleRateHz: typeof REALTIME_SAMPLE_RATE_HZ };
  recording: false;
  retention: false;
}

/** Places a real call only after all caller-supplied values have been validated. */
export async function startRealtimeCall(options: RealtimeCallStartOptions): Promise<RealtimeCallBoundary> {
  required(options.sessionId, "session ID");
  required(options.orgId, "organization ID");
  required(options.to, "destination phone number");
  required(options.from, "Twilio caller number");
  requireE164(options.to, "destination phone number");
  requireE164(options.from, "Twilio caller number");
  const twiml = generateBidirectionalStreamTwiml({ mediaStreamUrl: options.mediaStreamUrl, sessionToken: options.sessionToken });
  const timestamp = options.now ?? (() => new Date().toISOString());
  const id = options.createId ?? (() => crypto.randomUUID());
  try {
    const call = await options.twilio.createCall({ to: options.to, from: options.from, twiml, statusCallbackUrl: options.statusCallbackUrl, record: false });
    await appendVoiceTelemetry(options.telemetry, {
      id: id(), timestamp: timestamp(), orgId: options.orgId, appId: options.appId, sessionId: options.sessionId,
      traceId: options.sessionId, channel: "voice", kitId: "kit:debrief", type: "voice.call",
      operation: "outbound_call_started:recording-off:retention-off", model: null, provider: REALTIME_PROVIDER, callId: call.sid, outcome: "started",
    });
    return {
      callId: call.sid, sessionId: options.sessionId, provider: REALTIME_PROVIDER, status: "connecting",
      media: { transport: "twilio-media-streams", direction: "bidirectional", audioFormat: REALTIME_AUDIO_FORMAT, sampleRateHz: REALTIME_SAMPLE_RATE_HZ },
      recording: false, retention: false,
    };
  } catch (error) {
    await appendVoiceTelemetry(options.telemetry, {
      id: id(), timestamp: timestamp(), orgId: options.orgId, appId: options.appId, sessionId: options.sessionId,
      traceId: options.sessionId, channel: "voice", kitId: "kit:debrief", type: "voice.call",
      operation: "outbound_call_error:recording-off:retention-off", model: null, provider: REALTIME_PROVIDER, outcome: "error",
    });
    throw error;
  }
}

export interface VoiceAgentLoopAdapter {
  /** Receives only provider metadata; audio and transcript content stay in memory/provider buffers. */
  onProviderTurn?(event: RealtimeTurnEvent): Promise<void>;
  onInterruption?(): Promise<void>;
  onStop?(reason: string): Promise<void>;
  onError?(error: Error): Promise<void>;
}

export interface DefineAgentVoiceLoopOptions {
  sessionId: string;
  orgId: string;
  appId: string | null;
  instructions: { version: string; content: string };
  telemetry: Pick<TelemetryStore, "append">;
  now?: () => string;
  createId?: () => string;
  tools?: Parameters<typeof defineAgent>[0]["tools"];
  provider?: string | null;
  callId?: string | null;
  memoryIds?: readonly string[];
  onStop?: (reason: string) => Promise<void>;
  onError?: (error: Error) => Promise<void>;
}

export interface DefineAgentVoiceLoop extends VoiceAgentLoopAdapter {
  readonly done: Promise<AgentRunResult>;
}

/**
 * Supervises a provider-owned realtime speech session with defineAgent.
 * Realtime remains the low-latency audio/model connector; defineAgent owns the
 * bounded session lifecycle, instruction version, declared tool set, limits,
 * cancellation, and metadata-only turn events.
 */
export function createDefineAgentVoiceLoop(options: DefineAgentVoiceLoopOptions): DefineAgentVoiceLoop {
  const queue: Array<AgentInput> = [];
  const waiters: Array<(input: AgentInput | null) => void> = [];
  let closed = false;
  let resolveDone!: (value: AgentRunResult) => void;
  const done = new Promise<AgentRunResult>((resolve) => { resolveDone = resolve; });
  let result!: AgentRunResult;
  const controller = new AbortController();
  const next = async (): Promise<AgentInput | null> => {
    if (queue.length) return queue.shift()!;
    if (closed) return null;
    return new Promise((resolve) => waiters.push(resolve));
  };
  const push = (input: AgentInput) => {
    const waiter = waiters.shift();
    if (waiter) waiter(input);
    else queue.push(input);
  };
  const close = () => {
    if (closed) return;
    closed = true;
    while (waiters.length) waiters.shift()!(null);
  };
  const agent = defineAgent({
    id: "debrief-voice-interviewer",
    kitId: "kit:debrief",
    trigger: { id: "voice-call", identity: "sales-agent" },
    instructions: options.instructions,
    tools: options.tools ?? [],
    turnSource: { next: async () => next() },
    model: {
      turn: async () => ({ type: "message" as const, content: "provider_turn_completed" }),
    },
    output: { emit: async () => undefined },
    maxTurns: 30,
    maxDurationMs: 10 * 60_000,
    hooks: {
      onEvent: async (event: AgentLifecycleEvent) => {
        await options.telemetry.append({
          id: options.createId?.() ?? crypto.randomUUID(),
          timestamp: options.now?.() ?? new Date().toISOString(),
          orgId: options.orgId,
          appId: options.appId,
          sessionId: options.sessionId,
          traceId: options.sessionId,
          channel: "voice",
          kitId: "kit:debrief",
          type: event.type === "tool_called" ? "mcp.tool_call" : "voice.call",
          operation: `agent.${event.type}`,
          provider: options.provider ?? null,
          callId: options.callId ?? null,
          outcome: event.type === "turn_finished" && event.outcome === "error" ? "error" : "success",
          instructionVersions: event.type === "run_started" ? [event.instructionsVersion] : undefined,
          memoryIds: event.type === "run_started" ? options.memoryIds : undefined,
        });
      },
    },
  });
  void agent.run({ sessionId: options.sessionId, context: { orgId: options.orgId, appId: options.appId }, signal: controller.signal })
    .then((value) => { result = value; resolveDone(value); })
    .catch((error) => {
      result = {
        status: "failed",
        sessionId: options.sessionId,
        kitId: "kit:debrief",
        agentId: "debrief-voice-interviewer",
        triggerId: "voice-call",
        instructionsVersion: options.instructions.version,
        turns: 0,
        toolCalls: 0,
        outputs: 0,
        durationMs: 0,
        error: { code: "AGENT_SOURCE_ERROR", message: error instanceof Error ? error.message : String(error) },
      };
      resolveDone(result);
    });
  return {
    done,
    async onProviderTurn(event) {
      if (event.kind === "turn_completed") push({ content: "provider_turn_completed", metadata: { latencyMs: event.latencyMs ?? null } });
    },
    async onInterruption() {
      push({ content: "provider_interruption", metadata: { interruption: true } });
    },
    async onStop() {
      close();
      await done.catch(() => undefined);
      try { await options.onStop?.("provider_stop"); } catch { /* Session cleanup must not tear down the bridge. */ }
    },
    async onError(error) {
      close();
      controller.abort(error);
      await done.catch(() => undefined);
      try { await options.onError?.(error); } catch { /* Session cleanup must not tear down the bridge. */ }
    },
  };
}

/**
 * Narrow seam for the uncommitted defineAgent v1 work. This transport does
 * not implement an agent loop: defineAgent owns policy, turns, tools, limits,
 * and terminal status; this adapter only reports provider lifecycle events.
 */
export interface RealtimeTurnEvent {
  kind: "turn_started" | "turn_completed";
  sessionId: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  latencyMs?: number;
}

export type TranslatedRealtimeEvent =
  | { kind: "audio_delta"; payload: string }
  | { kind: "interruption" }
  | { kind: "turn_started" }
  | { kind: "turn_completed"; usage: { inputTokens?: number; outputTokens?: number } }
  | { kind: "error" }
  | { kind: "ignored" };

/** Maps OpenAI event names to content-free transport events. */
export function translateOpenAIRealtimeEvent(raw: unknown): TranslatedRealtimeEvent {
  const message = parseSocketMessage(raw);
  if (!message || typeof message !== "object") throw new Error("Invalid OpenAI Realtime message");
  const event = message as Record<string, unknown>;
  const type = typeof event.type === "string" ? event.type : "";
  if (type === "response.created") return { kind: "turn_started" };
  if (type === "input_audio_buffer.speech_started") return { kind: "interruption" };
  if (type === "response.audio.delta" || type === "response.output_audio.delta") {
    if (typeof event.delta !== "string") throw new Error("OpenAI audio delta is missing");
    return { kind: "audio_delta", payload: event.delta };
  }
  if (type === "response.done") return { kind: "turn_completed", usage: readUsage(event) };
  if (type === "error") return { kind: "error" };
  // Transcript events are intentionally reduced to an ignored metadata event.
  return { kind: "ignored" };
}

export interface TwilioMediaStart {
  streamSid: string;
  callSid?: string;
  customParameters: Readonly<Record<string, string | undefined>>;
}

export interface SessionBinding {
  streamSid: string;
  callSid?: string;
  sessionId: string;
  orgId: string;
  appId: string | null;
}

export interface SessionBindingStore {
  bind(binding: SessionBinding): void;
  get(streamSid: string): SessionBinding | undefined;
  remove(streamSid: string): void;
}

export function createSessionBindingStore(): SessionBindingStore {
  const bindings = new Map<string, SessionBinding>();
  return {
    bind(binding) { bindings.set(binding.streamSid, binding); },
    get(streamSid) { return bindings.get(streamSid); },
    remove(streamSid) { bindings.delete(streamSid); },
  };
}

export interface VoiceWebSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: "message" | "close" | "error", listener: (...args: any[]) => void): this;
}

export interface TwilioOpenAIBridgeOptions {
  twilioSocket: VoiceWebSocket;
  openai: RealtimeSessionOptions;
  verifier: SignedSessionTokenVerifier;
  bindings?: SessionBindingStore;
  signature?: { validator: TwilioSignatureValidator; url: string; params: Readonly<Record<string, string | string[] | undefined>>; value: string | undefined };
  telemetry: Pick<TelemetryStore, "append">;
  agent?: VoiceAgentLoopAdapter | ((binding: SessionBinding) => VoiceAgentLoopAdapter | Promise<VoiceAgentLoopAdapter>);
  /** Resolve prepared-session context before opening the provider model session. */
  instructionsFor?: (binding: SessionBinding) => Promise<string>;
  /** Finalize metadata-only call state once, after the provider stream stops. */
  onCallCompleted?: (call: { sessionId: string; orgId: string; appId: string | null; callId: string | null; reason: string; occurredAt: string }) => Promise<void>;
  now?: () => string;
  createId?: () => string;
  estimateCostUsd?: (usage: { inputTokens?: number; outputTokens?: number }) => number | null;
}

export interface TwilioOpenAIBridge {
  readonly binding: Promise<SessionBinding>;
  readonly done: Promise<void>;
}

/** Bridges Twilio JSON media events and OpenAI Realtime JSON events without persisting bodies. */
export function bridgeTwilioToOpenAI(options: TwilioOpenAIBridgeOptions): TwilioOpenAIBridge {
  if (options.signature && !options.signature.validator.validate({ url: options.signature.url, params: options.signature.params, signature: options.signature.value })) {
    options.twilioSocket.close(1008, "invalid Twilio signature");
    return { binding: Promise.reject(new Error("Invalid Twilio signature")), done: Promise.resolve() };
  }

  const bindings = options.bindings ?? createSessionBindingStore();
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.createId ?? (() => crypto.randomUUID());
  let realtime: OpenAIRealtimeSession | undefined;
  let streamSid: string | undefined;
  let turnStartedAt: number | undefined;
  let resolveBinding!: (binding: SessionBinding) => void;
  let rejectBinding!: (error: Error) => void;
  let resolveDone!: () => void;
  const binding = new Promise<SessionBinding>((resolve, reject) => { resolveBinding = resolve; rejectBinding = reject; });
  const done = new Promise<void>((resolve) => { resolveDone = resolve; });
  let finished = false;
  let twilioQueue = Promise.resolve();
  let agent: VoiceAgentLoopAdapter | undefined;

  const finish = async (reason: string, error?: Error) => {
    if (finished) return;
    finished = true;
    const current = streamSid ? bindings.get(streamSid) : undefined;
    if (streamSid) bindings.remove(streamSid);
    realtime?.close();
    if (error) await agent?.onError?.(error);
    else await agent?.onStop?.(reason);
    if (!error && current) {
      try {
        await options.onCallCompleted?.({
          sessionId: current.sessionId,
          orgId: current.orgId,
          appId: current.appId,
          callId: current.callSid ?? null,
          reason,
          occurredAt: now(),
        });
      } catch {
        // Provider shutdown must remain successful even if metadata finalization is unavailable.
      }
    }
    await appendVoiceTelemetry(options.telemetry, {
      id: id(), timestamp: now(), orgId: current?.orgId ?? "unknown", appId: current?.appId ?? null, sessionId: current?.sessionId ?? null,
      traceId: current?.sessionId ?? streamSid ?? null, channel: "voice", kitId: "kit:debrief", type: "voice.call",
      operation: error ? "media_stream_error" : "media_stream_stopped", provider: REALTIME_PROVIDER, callId: current?.callSid ?? null, outcome: error ? "error" : "success",
    });
    resolveDone();
  };

  const handle = async (raw: unknown) => {
    const message = parseSocketMessage(raw);
    if (!message || typeof message !== "object") throw new Error("Invalid WebSocket message");
    const event = message as Record<string, unknown>;
    if (event.event === "start") {
      if (streamSid) throw new Error("Duplicate Twilio stream start");
      const start = parseTwilioStart(event);
      const token = start.customParameters.kitstack_session_token;
      if (!token) throw new Error("Twilio stream is missing KitStack session token");
      const claims = await options.verifier.verify(token);
      const sessionBinding: SessionBinding = { ...claims, streamSid: start.streamSid, callSid: start.callSid };
      streamSid = start.streamSid;
      bindings.bind(sessionBinding);
      resolveBinding(sessionBinding);
      agent = typeof options.agent === "function" ? await options.agent(sessionBinding) : options.agent;
      const instructions = await options.instructionsFor?.(sessionBinding);
      realtime = await createOpenAIRealtimeSession({ ...options.openai, ...(instructions ? { instructions } : {}) });
      realtime.socket.on("message", (data: unknown) => { void handleOpenAI(data).catch((error) => { void finish("openai_error", asError(error)); }); });
      realtime.socket.on("error", (error: Error) => { void finish("openai_error", error); });
      await appendVoiceTelemetry(options.telemetry, {
        id: id(), timestamp: now(), orgId: claims.orgId, appId: claims.appId, sessionId: claims.sessionId,
        traceId: claims.sessionId, channel: "voice", kitId: "kit:debrief", type: "voice.call",
        operation: "media_stream_bound:recording-off:retention-off", provider: REALTIME_PROVIDER, callId: start.callSid ?? null, outcome: "started",
      });
      return;
    }
    if (event.event === "media") {
      if (!realtime || !streamSid) throw new Error("Twilio media arrived before stream start");
      const media = event.media as Record<string, unknown> | undefined;
      if (typeof media?.payload !== "string") throw new Error("Twilio media payload is missing");
      // Twilio and OpenAI both use base64 PCMU/μ-law at 8 kHz; no conversion is needed.
      realtime.sendAudio(media.payload);
      return;
    }
    if (event.event === "stop") {
      await finish("twilio_stop");
      return;
    }
    if (event.event === "mark") return;
    throw new Error(`Unsupported Twilio media event: ${String(event.event)}`);
  };

  const handleOpenAI = async (raw: unknown) => {
    const translated = translateOpenAIRealtimeEvent(raw);
    const current = streamSid ? bindings.get(streamSid) : undefined;
    if (translated.kind === "turn_started") {
      turnStartedAt = Date.now();
      await agent?.onProviderTurn?.({ kind: "turn_started", sessionId: current?.sessionId ?? "unknown" });
      return;
    }
    if (translated.kind === "interruption") {
      realtime?.cancelResponse();
      options.twilioSocket.send(JSON.stringify({ event: "clear", streamSid }));
      await agent?.onInterruption?.();
      return;
    }
    if (translated.kind === "audio_delta") {
      if (!streamSid) throw new Error("OpenAI audio delta arrived before stream start");
      options.twilioSocket.send(JSON.stringify({ event: "media", streamSid, media: { payload: translated.payload } }));
      return;
    }
    if (translated.kind === "turn_completed") {
      const usage = translated.usage;
      const latencyMs = turnStartedAt === undefined ? undefined : Date.now() - turnStartedAt;
      await agent?.onProviderTurn?.({ kind: "turn_completed", sessionId: current?.sessionId ?? "unknown", usage, latencyMs });
      await appendVoiceTelemetry(options.telemetry, {
        id: id(), timestamp: now(), orgId: current?.orgId ?? "unknown", appId: current?.appId ?? null,
        sessionId: current?.sessionId ?? null, traceId: current?.sessionId ?? null, channel: "voice", kitId: "kit:debrief",
        type: "inference", operation: "realtime_turn", model: options.openai.model,
        provider: REALTIME_PROVIDER, callId: current?.callSid ?? null,
        requestTokens: usage.inputTokens ?? null, responseTokens: usage.outputTokens ?? null,
        latencyMs: latencyMs ?? null, estimatedCostUsd: options.estimateCostUsd?.(usage) ?? null, outcome: "success",
      });
      turnStartedAt = undefined;
      return;
    }
    if (translated.kind === "error") throw new Error("OpenAI Realtime returned an error");
    // Transcription and other provider events are intentionally not retained or forwarded as content.
  };

  options.twilioSocket.on("message", (data: unknown) => {
    twilioQueue = twilioQueue.then(() => handle(data)).catch((error) => {
      const err = asError(error);
      rejectBinding(err);
      return finish("twilio_error", err);
    });
  });
  options.twilioSocket.on("close", () => { void finish("twilio_close"); });
  options.twilioSocket.on("error", (error: Error) => { rejectBinding(error); void finish("twilio_error", error); });
  return { binding, done };
}

async function appendVoiceTelemetry(telemetry: Pick<TelemetryStore, "append">, event: TelemetryEventInput): Promise<void> {
  await telemetry.append(event);
}

function parseTwilioStart(event: Record<string, unknown>): TwilioMediaStart {
  const start = event.start as Record<string, unknown> | undefined;
  const streamSid = typeof event.streamSid === "string" ? event.streamSid : typeof start?.streamSid === "string" ? start.streamSid : undefined;
  if (!streamSid) throw new Error("Twilio stream SID is missing");
  const params = start?.customParameters;
  const customParameters: Record<string, string | undefined> = {};
  if (params && typeof params === "object") for (const [key, value] of Object.entries(params)) if (typeof value === "string") customParameters[key] = value;
  return { streamSid, callSid: typeof start?.callSid === "string" ? start.callSid : undefined, customParameters };
}

function parseSocketMessage(raw: unknown): unknown {
  if (typeof raw === "string") return JSON.parse(raw);
  if (raw instanceof Uint8Array) return JSON.parse(Buffer.from(raw).toString("utf8"));
  if (raw && typeof raw === "object" && "data" in raw) return parseSocketMessage((raw as { data: unknown }).data);
  return raw;
}

function readUsage(event: Record<string, unknown>): { inputTokens?: number; outputTokens?: number } {
  const response = event.response as Record<string, unknown> | undefined;
  const usage = response?.usage as Record<string, unknown> | undefined;
  return {
    inputTokens: numberValue(usage?.input_tokens),
    outputTokens: numberValue(usage?.output_tokens),
  };
}

function numberValue(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function required(value: string | undefined, label: string): string { if (!value?.trim()) throw new Error(`${label} is required`); return value; }
function requireUrl(value: string, protocol: string, label: string): string { const url = new URL(required(value, label)); if (url.protocol !== protocol) throw new Error(`${label} must use ${protocol}//`); return url.toString(); }
function requireE164(value: string, label: string): void { if (!/^\+[1-9]\d{7,14}$/.test(value)) throw new Error(`${label} must be an E.164 phone number`); }
function xmlEscape(value: string): string { return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function valueForSignature(value: string | string[] | undefined): string { return Array.isArray(value) ? value.join(",") : value ?? ""; }
function asError(error: unknown): Error { return error instanceof Error ? error : new Error(String(error)); }
