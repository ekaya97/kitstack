import { createHmac, timingSafeEqual } from "node:crypto";
import WebSocket from "ws";
import { defineAgent, type AgentInput, type AgentLifecycleEvent, type AgentModelResponse, type AgentRunResult, type AgentTurnMetadata, type Connector } from "@kitstackco/sdk";
import { jwtVerify, SignJWT } from "jose";
import type { TelemetryEventInput } from "@kitstackco/sdk";

/** Metadata-only telemetry sink; audio, transcripts and tool payloads never reach it. */
export interface VoiceTelemetrySink {
  append(event: TelemetryEventInput): Promise<unknown> | unknown;
}

/** A function the realtime model may call. */
export interface RealtimeFunctionTool {
  readonly type: "function";
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

const DEFAULT_KIT_ID = "kit:voice";

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

/** Deploy-time config; the auth token is deliberately resolved separately. */
export interface TwilioConnectorConfig {
  accountSid: string;
  apiBaseUrl?: string;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

export interface TwilioSmsRequest {
  to: string;
  from: string;
  body: string;
}

export interface TwilioSmsResponse {
  sid: string;
  status?: string;
}

export interface TwilioSmsClient {
  sendMessage(request: TwilioSmsRequest): Promise<TwilioSmsResponse>;
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

/** Server-side Twilio Messages API client. The auth token stays in closure scope. */
export function createTwilioSmsClient(options: TwilioClientOptions): TwilioSmsClient {
  const accountSid = required(options.accountSid, "Twilio account SID");
  const authToken = required(options.authToken, "Twilio auth token");
  const apiBaseUrl = (options.apiBaseUrl ?? "https://api.twilio.com").replace(/\/$/, "");
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new Error("A fetch implementation is required for Twilio SMS");

  return {
    async sendMessage(request) {
      const endpoint = `${apiBaseUrl}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: request.to, From: request.from, Body: request.body }),
      });
      if (!response.ok) throw new Error(`Twilio Messages API returned HTTP ${response.status}`);
      const payload = await response.json() as { sid?: unknown; status?: unknown };
      if (typeof payload.sid !== "string" || !payload.sid) throw new Error("Twilio Messages API returned no message SID");
      return { sid: payload.sid, status: typeof payload.status === "string" ? payload.status : undefined };
    },
  };
}

/** Twilio voice connector instance; credentials are resolved by bindConnector at deploy time. */
export const twilioVoiceConnector: Connector<TwilioConnectorConfig, TwilioCallsClient> = {
  manifest: {
    id: "twilio.voice",
    version: "0.1.0",
    capabilities: ["voice.call"],
    requiredScopes: ["telephony.calls.write"],
  },
  async bind(config, secrets) {
    return createTwilioCallsClient({
      accountSid: config.accountSid,
      apiBaseUrl: config.apiBaseUrl,
      fetch: config.fetch,
      authToken: await secrets.resolve("authToken"),
    });
  },
};

/** Twilio SMS connector instance; it shares the provider binding contract with voice. */
export const twilioSmsConnector: Connector<TwilioConnectorConfig, TwilioSmsClient> = {
  manifest: {
    id: "twilio.sms",
    version: "0.1.0",
    capabilities: ["messaging.sms"],
    requiredScopes: ["telephony.messages.write"],
  },
  async bind(config, secrets) {
    return createTwilioSmsClient({
      accountSid: config.accountSid,
      apiBaseUrl: config.apiBaseUrl,
      fetch: config.fetch,
      authToken: await secrets.resolve("authToken"),
    });
  },
};

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
  tools?: readonly RealtimeFunctionTool[];
  /** Let the bridge attach event handlers before the initial greeting starts. */
  deferInitialResponse?: boolean;
  /** Server VAD activation threshold (0-1); higher ignores more background noise. */
  vadThreshold?: number;
  /** Silence after speech before the caller's turn ends and the agent answers. */
  silenceDurationMs?: number;
  /** Audio kept from before the detected start of speech. */
  prefixPaddingMs?: number;
}

/**
 * Turn-detection defaults for phone audio, tuned on live calls: 0.6/500 ms
 * answered late and missed some interruptions; adjust in small steps.
 */
export const DEFAULT_VAD_THRESHOLD = 0.55;
export const DEFAULT_SILENCE_DURATION_MS = 420;
export const DEFAULT_PREFIX_PADDING_MS = 300;

export interface OpenAIRealtimeSession {
  socket: OpenAIRealtimeSocket;
  sendAudio(payload: string): void;
  cancelResponse(): void;
  /** Drop a committed caller turn (noise or a backchannel) from the conversation. */
  deleteItem(itemId: string): void;
  sendToolResult(callId: string, output: unknown): void;
  startResponse(): void;
  close(): void;
}

/** Opens a model session and sends the privacy/audio-format setup before media. */
export async function createOpenAIRealtimeSession(options: RealtimeSessionOptions): Promise<OpenAIRealtimeSession> {
  const socket = await options.socketFactory.connect({ url: options.url, apiKey: options.apiKey, model: options.model });
  socket.send(JSON.stringify({
    type: "session.update",
    session: {
      type: "realtime",
      ...(options.instructions ? { instructions: options.instructions } : {}),
      output_modalities: ["audio"],
      audio: {
        input: {
          format: { type: "audio/pcmu" },
          // Phone audio picks up line noise and the agent's own echo. The
          // bridge decides when speech is a real turn or barge-in, so the
          // model neither answers nor cancels on its own.
          noise_reduction: { type: "near_field" },
          turn_detection: {
            type: "server_vad",
            threshold: options.vadThreshold ?? DEFAULT_VAD_THRESHOLD,
            prefix_padding_ms: options.prefixPaddingMs ?? DEFAULT_PREFIX_PADDING_MS,
            silence_duration_ms: options.silenceDurationMs ?? DEFAULT_SILENCE_DURATION_MS,
            create_response: false,
            interrupt_response: false,
          },
        },
        output: { format: { type: "audio/pcmu" }, ...(options.voice ? { voice: options.voice } : {}) },
      },
      ...(options.tools?.length ? { tools: options.tools } : {}),
    },
  }));
  const startResponse = () => {
    // Outbound calls need an explicit first response; otherwise server VAD
    // waits for the callee to speak before the agent ever greets them.
    socket.send(JSON.stringify({ type: "response.create", response: { output_modalities: ["audio"] } }));
  };
  if (!options.deferInitialResponse) startResponse();
  return {
    socket,
    sendAudio(payload) { socket.send(JSON.stringify({ type: "input_audio_buffer.append", audio: payload })); },
    cancelResponse() { socket.send(JSON.stringify({ type: "response.cancel" })); },
    deleteItem(itemId) { socket.send(JSON.stringify({ type: "conversation.item.delete", item_id: itemId })); },
    sendToolResult(callId, output) {
      socket.send(JSON.stringify({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) },
      }));
      startResponse();
    },
    startResponse,
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
  telemetry: VoiceTelemetrySink;
  /** Kit the call belongs to, for telemetry (e.g. "kit:debrief"). */
  kitId?: string;
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
      traceId: options.sessionId, channel: "voice", kitId: options.kitId ?? DEFAULT_KIT_ID, type: "voice.call",
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
      traceId: options.sessionId, channel: "voice", kitId: options.kitId ?? DEFAULT_KIT_ID, type: "voice.call",
      operation: "outbound_call_error:recording-off:retention-off", model: null, provider: REALTIME_PROVIDER, outcome: "error",
    });
    throw error;
  }
}

export interface VoiceAgentLoopAdapter {
  /** Receives provider metadata; audio and transcript content stay in memory/provider buffers. */
  onProviderTurn?(event: RealtimeTurnEvent): Promise<void>;
  onProviderToolCall?(event: RealtimeToolCallEvent): Promise<void>;
  onInterruption?(): Promise<void>;
  onStop?(reason: string): Promise<void>;
  onError?(error: Error): Promise<void>;
}

export interface DefineAgentVoiceLoopOptions {
  sessionId: string;
  orgId: string;
  appId: string | null;
  instructions: { version: string; content: string };
  telemetry: VoiceTelemetrySink;
  /** Kit and agent identity for telemetry and the defineAgent run. */
  kitId?: string;
  agentId?: string;
  now?: () => string;
  createId?: () => string;
  tools?: Parameters<typeof defineAgent>[0]["tools"];
  provider?: string | null;
  model?: string | null;
  routingReason?: string | null;
  callId?: string | null;
  memoryIds?: readonly string[];
  /** Sends a completed defineAgent tool result back into the provider session. */
  sendToolResult?: (callId: string, output: unknown) => void | Promise<void>;
  estimateCostUsd?: (usage: { requestTokens?: number | null; responseTokens?: number | null }) => number | null;
  onStop?: (reason: string) => Promise<void>;
  onError?: (error: Error) => Promise<void>;
}

export interface DefineAgentVoiceLoop extends VoiceAgentLoopAdapter {
  readonly done: Promise<AgentRunResult>;
}

interface ProviderResponseWaiter {
  resolve: (response: AgentModelResponse) => void;
  reject: (error: unknown) => void;
}

function lifecycleOutcome(event: AgentLifecycleEvent): "success" | "error" {
  if (event.type === "tool_called") return event.outcome === "completed" ? "success" : "error";
  if (event.type === "turn_finished") return event.outcome === "error" ? "error" : "success";
  if (event.type === "run_finished") {
    return event.status === "completed" ? "success" : "error";
  }
  return "success";
}

/** Adapt the SDK's content-free agent lifecycle event to a voice telemetry event. */
function toVoiceLifecycleTelemetry(
  event: AgentLifecycleEvent,
  options: DefineAgentVoiceLoopOptions,
): TelemetryEventInput {
  const metadata = "provider" in event
    ? {
        provider: event.provider ?? options.provider ?? null,
        model: event.model ?? options.model ?? null,
        requestTokens: event.requestTokens ?? null,
        responseTokens: event.responseTokens ?? null,
        estimatedCostUsd: event.costUsd ?? null,
        latencyMs: "latencyMs" in event ? event.latencyMs ?? null : ("durationMs" in event ? event.durationMs : null),
        ...(event.routingReason === undefined && options.routingReason === undefined
          ? {}
          : { routingReason: event.routingReason ?? options.routingReason ?? null }),
        ...(event.cancellationReason === undefined ? {} : { cancellationReason: event.cancellationReason }),
        ...(event.timeoutReason === undefined ? {} : { timeoutReason: event.timeoutReason }),
      }
    : {};
  return {
    id: options.createId?.() ?? crypto.randomUUID(),
    timestamp: new Date(event.at).toISOString(),
    orgId: options.orgId,
    appId: options.appId,
    sessionId: event.sessionId,
    traceId: event.traceId,
    parentId: event.parentId ?? null,
    channel: "voice",
    kitId: options.kitId ?? DEFAULT_KIT_ID,
    type: event.type === "tool_called" ? "mcp.tool_call" : "voice.call",
    operation: `agent.${event.type}`,
    callId: options.callId ?? null,
    outcome: lifecycleOutcome(event),
    ...metadata,
    instructionVersions: event.type === "run_started" ? [event.instructionsVersion] : undefined,
    memoryIds: event.type === "run_started" ? options.memoryIds : undefined,
  };
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
  const providerResponses: AgentModelResponse[] = [];
  const providerResponseWaiters: ProviderResponseWaiter[] = [];
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
  const nextProviderResponse = (signal: AbortSignal): Promise<AgentModelResponse> => {
    if (providerResponses.length) return Promise.resolve(providerResponses.shift()!);
    if (signal.aborted) return Promise.reject(signal.reason ?? new Error("Agent provider response wait was aborted"));
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        const index = providerResponseWaiters.findIndex((waiter) => waiter.resolve === resolve);
        if (index >= 0) providerResponseWaiters.splice(index, 1);
        reject(signal.reason ?? new Error("Agent provider response wait was aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      providerResponseWaiters.push({
        resolve: (response) => { signal.removeEventListener("abort", onAbort); resolve(response); },
        reject: (error) => { signal.removeEventListener("abort", onAbort); reject(error); },
      });
    });
  };
  const pushProviderResponse = (response: AgentModelResponse) => {
    const waiter = providerResponseWaiters.shift();
    if (waiter) waiter.resolve(response);
    else providerResponses.push(response);
  };
  const agent = defineAgent({
    id: options.agentId ?? "voice-agent",
    kitId: options.kitId ?? DEFAULT_KIT_ID,
    trigger: { id: "voice-call", identity: "voice-agent" },
    instructions: options.instructions,
    tools: options.tools ?? [],
    turnSource: { next: async () => next() },
    model: {
      provider: options.provider ?? undefined,
      model: options.model ?? undefined,
      estimateCostUsd: options.estimateCostUsd,
      turn: async ({ input, history, signal }) => {
        const latest = history.at(-1);
        if (latest?.role === "tool") {
          await options.sendToolResult?.(latest.toolCallId, latest.isError ? { error: latest.result } : latest.result);
        }
        if (!options.sendToolResult) {
          return {
            type: "message" as const,
            content: "provider_turn_completed",
            metadata: input?.metadata as AgentTurnMetadata | undefined,
          };
        }
        return nextProviderResponse(signal);
      },
    },
    output: { emit: async () => undefined },
    maxTurns: 30,
    maxDurationMs: 10 * 60_000,
    hooks: {
      onEvent: async (event: AgentLifecycleEvent) => {
        await options.telemetry.append(toVoiceLifecycleTelemetry(event, options));
      },
    },
  });
  void agent.run({ sessionId: options.sessionId, traceId: options.sessionId, context: { orgId: options.orgId, appId: options.appId }, signal: controller.signal })
    .then((value) => { result = value; resolveDone(value); })
    .catch((error) => {
      result = {
        status: "failed",
        sessionId: options.sessionId,
        kitId: options.kitId ?? DEFAULT_KIT_ID,
        agentId: options.agentId ?? "voice-agent",
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
      if (event.kind === "turn_completed") {
        if (options.sendToolResult) {
          pushProviderResponse({
            type: "message",
            content: "provider_turn_completed",
            metadata: {
              requestTokens: event.usage?.inputTokens ?? null,
              responseTokens: event.usage?.outputTokens ?? null,
              latencyMs: event.latencyMs ?? null,
            },
          });
        }
        push({
          content: "provider_turn_completed",
          metadata: {
            requestTokens: event.usage?.inputTokens ?? null,
            responseTokens: event.usage?.outputTokens ?? null,
            latencyMs: event.latencyMs ?? null,
          },
        });
      }
    },
    async onProviderToolCall(event) {
      pushProviderResponse({
        type: "tool_call",
        toolCallId: event.callId,
        name: event.name,
        args: event.args,
      });
    },
    async onInterruption() {
      push({ content: "provider_interruption", metadata: { interruption: true } });
    },
    async onStop() {
      close();
      if (options.sendToolResult) {
        // A provider stop can arrive while the model connector is waiting for
        // the response that follows a tool result. Resolve that wait as a
        // terminal provider response so the defineAgent run can finish
        // cleanly; abort only if the provider-aware loop does not drain.
        pushProviderResponse({ type: "message", content: "provider_stop", terminal: true });
        const drained = await Promise.race([
          done.then(() => true),
          new Promise<false>((resolve) => setTimeout(() => resolve(false), 250)),
        ]);
        if (!drained) controller.abort();
      }
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

export interface RealtimeToolCallEvent {
  callId: string;
  name: string;
  args: unknown;
}

export type TranslatedRealtimeEvent =
  | { kind: "audio_delta"; payload: string }
  | { kind: "speech_started" }
  | { kind: "speech_stopped" }
  | { kind: "speech_committed"; itemId?: string }
  | { kind: "turn_started" }
  | { kind: "turn_completed"; usage: { inputTokens?: number; outputTokens?: number } }
  | { kind: "tool_call"; callId: string; name: string; args: unknown }
  | { kind: "error"; message?: string; code?: string }
  | { kind: "ignored" };

/** Maps OpenAI event names to content-free transport events. */
export function translateOpenAIRealtimeEvent(raw: unknown): TranslatedRealtimeEvent {
  const message = parseSocketMessage(raw);
  if (!message || typeof message !== "object") throw new Error("Invalid OpenAI Realtime message");
  const event = message as Record<string, unknown>;
  const type = typeof event.type === "string" ? event.type : "";
  if (type === "response.created") return { kind: "turn_started" };
  if (type === "input_audio_buffer.speech_started") return { kind: "speech_started" };
  if (type === "input_audio_buffer.speech_stopped") return { kind: "speech_stopped" };
  if (type === "input_audio_buffer.committed") return { kind: "speech_committed", ...(typeof event.item_id === "string" ? { itemId: event.item_id } : {}) };
  if (type === "response.audio.delta" || type === "response.output_audio.delta") {
    if (typeof event.delta !== "string") throw new Error("OpenAI audio delta is missing");
    return { kind: "audio_delta", payload: event.delta };
  }
  if (type === "response.function_call_arguments.done") {
    const callId = typeof event.call_id === "string" ? event.call_id : "";
    const name = typeof event.name === "string" ? event.name : "";
    if (!callId || !name || typeof event.arguments !== "string") throw new Error("OpenAI function call is incomplete");
    return { kind: "tool_call", callId, name, args: parseToolArguments(event.arguments) };
  }
  if (type === "response.output_item.done") {
    const item = event.item as Record<string, unknown> | undefined;
    if (item?.type === "function_call") {
      const callId = typeof item.call_id === "string" ? item.call_id : "";
      const name = typeof item.name === "string" ? item.name : "";
      if (!callId || !name || typeof item.arguments !== "string") throw new Error("OpenAI function call item is incomplete");
      return { kind: "tool_call", callId, name, args: parseToolArguments(item.arguments) };
    }
  }
  if (type === "response.done") return { kind: "turn_completed", usage: readUsage(event) };
  if (type === "error") {
    const providerError = event.error as Record<string, unknown> | undefined;
    return {
      kind: "error",
      message: typeof providerError?.message === "string" ? providerError.message : undefined,
      code: typeof providerError?.code === "string" ? providerError.code : undefined,
    };
  }
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
  /** Kit the call belongs to, for telemetry (e.g. "kit:debrief"). */
  kitId?: string;
  provider?: string;
  routingReason?: string | null;
  verifier: SignedSessionTokenVerifier;
  bindings?: SessionBindingStore;
  signature?: { validator: TwilioSignatureValidator; url: string; params: Readonly<Record<string, string | string[] | undefined>>; value: string | undefined };
  telemetry: VoiceTelemetrySink;
  agent?: VoiceAgentLoopAdapter | ((binding: SessionBinding, provider: OpenAIRealtimeSession, call: VoiceCallControl) => VoiceAgentLoopAdapter | Promise<VoiceAgentLoopAdapter>);
  /** Resolve prepared-session context before opening the provider model session. */
  instructionsFor?: (binding: SessionBinding) => Promise<string>;
  /** Finalize metadata-only call state once, after the provider stream stops. */
  onCallCompleted?: (call: { sessionId: string; orgId: string; appId: string | null; callId: string | null; reason: string; occurredAt: string; provider: string }) => Promise<void>;
  stopReason?: string;
  /** Upper bound between an agent hangup request and the call ending. */
  hangupTimeoutMs?: number;
  /**
   * How long after the caller starts talking over the agent before it stops,
   * unless the caller's turn ends first. Server VAD reports the end of a turn
   * only after its silence duration, so this must exceed that duration: the
   * default is the silence duration plus BARGE_IN_MIN_SPEECH_MS. Shorter
   * sounds (noise, echo, "mhm") are ignored while the agent speaks.
   */
  bargeInMs?: number;
  now?: () => string;
  createId?: () => string;
  estimateCostUsd?: (usage: { inputTokens?: number; outputTokens?: number }) => number | null;
}

export interface TwilioOpenAIBridge {
  readonly binding: Promise<SessionBinding>;
  readonly done: Promise<void>;
}

/** Bridges Twilio JSON media events and OpenAI Realtime JSON events without persisting bodies. */
/** Call controls the bridge hands to the agent loop for its tools. */
export interface VoiceCallControl {
  /**
   * End the call once the agent's next response has finished playing. The
   * provider is told via a Twilio mark; a timeout ends the call if the mark
   * is never echoed (for example, by a local browser stream).
   */
  hangup(): void;
}

const HANGUP_MARK = "kitstack-hangup";
// Speech shorter than this, over the agent, is treated as noise or a backchannel.
const BARGE_IN_MIN_SPEECH_MS = 100;
// μ-law at 8 kHz: one byte per sample, eight samples per millisecond.
const PCMU_BYTES_PER_MS = 8;
const DEFAULT_HANGUP_TIMEOUT_MS = 15_000;

export function bridgeTwilioToOpenAI(options: TwilioOpenAIBridgeOptions): TwilioOpenAIBridge {
  if (options.signature && !options.signature.validator.validate({ url: options.signature.url, params: options.signature.params, signature: options.signature.value })) {
    options.twilioSocket.close(1008, "invalid Twilio signature");
    return { binding: Promise.reject(new Error("Invalid Twilio signature")), done: Promise.resolve() };
  }

  const bindings = options.bindings ?? createSessionBindingStore();
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.createId ?? (() => crypto.randomUUID());
  const provider = options.provider ?? REALTIME_PROVIDER;
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
  let openaiQueue = Promise.resolve();
  const handledProviderToolCalls = new Set<string>();
  let agent: VoiceAgentLoopAdapter | undefined;
  let responsesStarted = 0;
  let responseActive = false;
  // When the audio already sent to the caller finishes playing (wall clock).
  let playbackEndsAt = 0;
  // The caller turn currently being heard: `bargeIn` while the agent speaks.
  let callerTurn: { bargeIn: boolean; confirmed: boolean; timer?: ReturnType<typeof setTimeout> } | undefined;
  const bargeInMs = options.bargeInMs
    ?? (options.openai.silenceDurationMs ?? DEFAULT_SILENCE_DURATION_MS) + BARGE_IN_MIN_SPEECH_MS;
  // When server VAD reported the caller stopped speaking, until the agent's
  // first audio of the answer: the delay the caller hears.
  let speechStoppedAt: number | undefined;
  let answerPendingSince: number | undefined;
  let hangupAfterResponse: number | undefined;
  // Name of the mark whose echo ends the call; cleared when an interruption
  // makes Twilio echo pending marks without playing the queued audio.
  let hangupMark: string | undefined;
  let hangupMarks = 0;
  let hangupTimer: ReturnType<typeof setTimeout> | undefined;

  const endCall = async (reason: string) => {
    if (hangupTimer) clearTimeout(hangupTimer);
    await finish(reason);
    // <Connect><Stream> is the last TwiML verb, so closing the stream ends the call.
    options.twilioSocket.close(1000, "call ended by agent");
  };
  const sendHangupMark = () => {
    if (hangupMark || finished) return;
    hangupMarks += 1;
    hangupMark = `${HANGUP_MARK}-${hangupMarks}`;
    options.twilioSocket.send(JSON.stringify({ event: "mark", streamSid, mark: { name: hangupMark } }));
  };
  const callControl: VoiceCallControl = {
    hangup() {
      if (hangupAfterResponse !== undefined || finished) return;
      // Wait for a response that starts after this request (the goodbye that
      // follows the tool result), so the caller hears it before the line drops.
      hangupAfterResponse = responsesStarted;
      hangupTimer = setTimeout(() => { void endCall("agent_hangup_timeout"); }, options.hangupTimeoutMs ?? DEFAULT_HANGUP_TIMEOUT_MS);
    },
  };

  const finish = async (reason: string, error?: Error) => {
    if (finished) return;
    finished = true;
    if (hangupTimer) clearTimeout(hangupTimer);
    if (callerTurn?.timer) clearTimeout(callerTurn.timer);
    if (error) console.error(`[voice] media stream ended with error (${reason}): ${error.message}`);
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
          provider,
        });
      } catch {
        // Provider shutdown must remain successful even if metadata finalization is unavailable.
      }
    }
    await appendVoiceTelemetry(options.telemetry, {
      id: id(), timestamp: now(), orgId: current?.orgId ?? "unknown", appId: current?.appId ?? null, sessionId: current?.sessionId ?? null,
      traceId: current?.sessionId ?? streamSid ?? null, channel: "voice", kitId: options.kitId ?? DEFAULT_KIT_ID, type: "voice.call",
      operation: error ? "media_stream_error" : "media_stream_stopped", provider, callId: current?.callSid ?? null, outcome: error ? "error" : "success",
    });
    // Without a working model the caller would hear silence; end the call.
    // Closing an already-closed provider stream is a no-op.
    if (error) options.twilioSocket.close(1011, "call ended after provider error");
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
      const instructions = await options.instructionsFor?.(sessionBinding);
      realtime = await createOpenAIRealtimeSession({ ...options.openai, deferInitialResponse: true, ...(instructions ? { instructions } : {}) });
      agent = typeof options.agent === "function" ? await options.agent(sessionBinding, realtime, callControl) : options.agent;
      realtime.socket.on("message", (data: unknown) => {
        openaiQueue = openaiQueue.then(() => handleOpenAI(data)).catch((error) => finish("openai_error", asError(error)));
      });
      realtime.socket.on("error", (error: Error) => { void finish("openai_error", error); });
      realtime.socket.on("close", () => { void finish("openai_close", new Error("OpenAI Realtime connection closed")); });
      await appendVoiceTelemetry(options.telemetry, {
        id: id(), timestamp: now(), orgId: claims.orgId, appId: claims.appId, sessionId: claims.sessionId,
        traceId: claims.sessionId, channel: "voice", kitId: options.kitId ?? DEFAULT_KIT_ID, type: "voice.call",
        operation: "media_stream_bound:recording-off:retention-off", provider, callId: start.callSid ?? null, outcome: "started",
      });
      realtime.startResponse();
      resolveBinding(sessionBinding);
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
      await finish(options.stopReason ?? "twilio_stop");
      return;
    }
    if (event.event === "mark") {
      const mark = event.mark as Record<string, unknown> | undefined;
      // Twilio echoes a mark once all audio sent before it has played.
      if (hangupMark && mark?.name === hangupMark) await endCall("agent_hangup");
      return;
    }
    // Twilio always sends `connected` before `start`; treating it as fatal
    // would finish the bridge before the call begins and ignore the real stop.
    if (event.event === "connected" || event.event === "dtmf") return;
    throw new Error(`Unsupported Twilio media event: ${String(event.event)}`);
  };

  const interruptAgent = async (current: SessionBinding | undefined) => {
    if (responseActive) realtime?.cancelResponse();
    playbackEndsAt = 0;
    if (hangupAfterResponse !== undefined) {
      // `clear` makes Twilio echo pending marks at once, so the old mark no
      // longer means "goodbye played". Hang up after the agent's reply instead.
      hangupMark = undefined;
      hangupAfterResponse = responsesStarted;
      if (hangupTimer) clearTimeout(hangupTimer);
      hangupTimer = setTimeout(() => { void endCall("agent_hangup_timeout"); }, options.hangupTimeoutMs ?? DEFAULT_HANGUP_TIMEOUT_MS);
    }
    options.twilioSocket.send(JSON.stringify({ event: "clear", streamSid }));
    await appendVoiceTelemetry(options.telemetry, {
      id: id(), timestamp: now(), orgId: current?.orgId ?? "unknown", appId: current?.appId ?? null,
      sessionId: current?.sessionId ?? null, traceId: current?.sessionId ?? null, channel: "voice", kitId: options.kitId ?? DEFAULT_KIT_ID,
      type: "voice.call", operation: hangupAfterResponse !== undefined ? "caller_interruption:hangup_pending" : "caller_interruption",
      provider, callId: current?.callSid ?? null, outcome: "success",
    });
    await agent?.onInterruption?.();
  };

  const handleOpenAI = async (raw: unknown) => {
    const translated = translateOpenAIRealtimeEvent(raw);
    const current = streamSid ? bindings.get(streamSid) : undefined;
    if (translated.kind === "turn_started") {
      turnStartedAt = Date.now();
      responsesStarted += 1;
      responseActive = true;
      await agent?.onProviderTurn?.({ kind: "turn_started", sessionId: current?.sessionId ?? "unknown" });
      return;
    }
    if (translated.kind === "speech_started") {
      const agentSpeaking = responseActive || Date.now() < playbackEndsAt;
      if (callerTurn?.timer) clearTimeout(callerTurn.timer);
      callerTurn = { bargeIn: agentSpeaking, confirmed: !agentSpeaking };
      if (agentSpeaking) {
        const turn = callerTurn;
        turn.timer = setTimeout(() => {
          if (callerTurn !== turn || finished) return;
          turn.confirmed = true;
          openaiQueue = openaiQueue.then(() => interruptAgent(current)).catch((error) => finish("openai_error", asError(error)));
        }, bargeInMs);
      }
      return;
    }
    if (translated.kind === "speech_stopped") {
      if (callerTurn?.timer) clearTimeout(callerTurn.timer);
      speechStoppedAt = Date.now();
      return;
    }
    if (translated.kind === "speech_committed") {
      const turn = callerTurn;
      callerTurn = undefined;
      const agentStillSpeaking = responseActive || Date.now() < playbackEndsAt;
      if (turn && !turn.confirmed && agentStillSpeaking) {
        // Too short to be a real barge-in: keep talking and forget the sound.
        // (If the agent has finished meanwhile, it was an answer: respond.)
        if (translated.itemId) realtime?.deleteItem(translated.itemId);
        await appendVoiceTelemetry(options.telemetry, {
          id: id(), timestamp: now(), orgId: current?.orgId ?? "unknown", appId: current?.appId ?? null,
          sessionId: current?.sessionId ?? null, traceId: current?.sessionId ?? null, channel: "voice", kitId: options.kitId ?? DEFAULT_KIT_ID,
          type: "voice.call", operation: "caller_sound_ignored", provider, callId: current?.callSid ?? null, outcome: "success",
        });
        return;
      }
      answerPendingSince = speechStoppedAt;
      realtime?.startResponse();
      return;
    }
    if (translated.kind === "audio_delta") {
      if (!streamSid) throw new Error("OpenAI audio delta arrived before stream start");
      if (answerPendingSince !== undefined) {
        // The caller also waited out the VAD silence before speech_stopped.
        const silenceMs = options.openai.silenceDurationMs ?? DEFAULT_SILENCE_DURATION_MS;
        const latencyMs = Date.now() - answerPendingSince + silenceMs;
        answerPendingSince = undefined;
        await appendVoiceTelemetry(options.telemetry, {
          id: id(), timestamp: now(), orgId: current?.orgId ?? "unknown", appId: current?.appId ?? null,
          sessionId: current?.sessionId ?? null, traceId: current?.sessionId ?? null, channel: "voice", kitId: options.kitId ?? DEFAULT_KIT_ID,
          type: "voice.call", operation: "answer_latency", provider, callId: current?.callSid ?? null, latencyMs, outcome: "success",
        });
      }
      options.twilioSocket.send(JSON.stringify({ event: "media", streamSid, media: { payload: translated.payload } }));
      const bytes = Math.floor((translated.payload.length * 3) / 4);
      playbackEndsAt = Math.max(Date.now(), playbackEndsAt) + bytes / PCMU_BYTES_PER_MS;
      return;
    }
    if (translated.kind === "tool_call") {
      if (handledProviderToolCalls.has(translated.callId)) return;
      handledProviderToolCalls.add(translated.callId);
      await agent?.onProviderToolCall?.(translated);
      return;
    }
    if (translated.kind === "turn_completed") {
      const usage = translated.usage;
      const latencyMs = turnStartedAt === undefined ? undefined : Date.now() - turnStartedAt;
      await agent?.onProviderTurn?.({ kind: "turn_completed", sessionId: current?.sessionId ?? "unknown", usage, latencyMs });
      await appendVoiceTelemetry(options.telemetry, {
        id: id(), timestamp: now(), orgId: current?.orgId ?? "unknown", appId: current?.appId ?? null,
        sessionId: current?.sessionId ?? null, traceId: current?.sessionId ?? null, channel: "voice", kitId: options.kitId ?? DEFAULT_KIT_ID,
        type: "inference", operation: "realtime_turn", model: options.openai.model,
        provider, callId: current?.callSid ?? null,
        requestTokens: usage.inputTokens ?? null, responseTokens: usage.outputTokens ?? null,
        routingReason: options.routingReason ?? null,
        latencyMs: latencyMs ?? null, estimatedCostUsd: options.estimateCostUsd?.(usage) ?? null, outcome: "success",
      });
      turnStartedAt = undefined;
      responseActive = false;
      if (hangupAfterResponse !== undefined && responsesStarted > hangupAfterResponse) sendHangupMark();
      return;
    }
    if (translated.kind === "error") {
      // GA Realtime can report this when VAD detects speech just after a
      // response has already completed. It is a harmless interruption race,
      // not a failed call.
      if (translated.code === "response_cancel_not_active") return;
      const detail = [translated.code, translated.message].filter(Boolean).join(": ");
      throw new Error(`OpenAI Realtime returned an error${detail ? ` (${detail})` : ""}`);
    }
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

async function appendVoiceTelemetry(telemetry: VoiceTelemetrySink, event: TelemetryEventInput): Promise<void> {
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

function parseToolArguments(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("OpenAI function call arguments are not valid JSON");
  }
}

function numberValue(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function required(value: string | undefined, label: string): string { if (!value?.trim()) throw new Error(`${label} is required`); return value; }
function requireUrl(value: string, protocol: string, label: string): string { const url = new URL(required(value, label)); if (url.protocol !== protocol) throw new Error(`${label} must use ${protocol}//`); return url.toString(); }
function requireE164(value: string, label: string): void { if (!/^\+[1-9]\d{7,14}$/.test(value)) throw new Error(`${label} must be an E.164 phone number`); }
function xmlEscape(value: string): string { return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function valueForSignature(value: string | string[] | undefined): string { return Array.isArray(value) ? value.join(",") : value ?? ""; }
function asError(error: unknown): Error { return error instanceof Error ? error : new Error(String(error)); }
