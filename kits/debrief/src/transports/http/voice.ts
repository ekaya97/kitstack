import {
  bridgeTwilioToOpenAI,
  generateBidirectionalStreamTwiml,
  startRealtimeCall,
  type OpenAIRealtimeSocketFactory,
  type RealtimeCallStartOptions,
  type SignedSessionTokenVerifier,
  type TwilioCallsClient,
  type TwilioOpenAIBridge,
  type TwilioSignatureValidator,
  type TwilioSignatureInput,
  type VoiceWebSocket,
  type SessionBinding,
} from "../../adapters/voice/realtime.js";
import type { TelemetryStore } from "../../telemetry/index.js";

export interface VoiceHttpRequest {
  method: string;
  path: string;
  url?: string;
  headers?: Readonly<Record<string, string | undefined>>;
  body?: Readonly<Record<string, unknown>>;
}

export interface VoiceHttpResponse<T = unknown> {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: T;
}

export interface LiveVoiceHttpOptions {
  twilio: TwilioCallsClient;
  telemetry: Pick<TelemetryStore, "append">;
  orgId: string;
  appId: string | null;
  mediaStreamUrl: string;
  fromNumber: string;
  sessionTokenFor: (sessionId: string) => Promise<string>;
  now?: () => string;
  createId?: () => string;
  statusCallbackUrl?: string;
  /** A demo-only allowlist prevents accidental calls to arbitrary numbers. */
  allowedDestinations?: readonly string[];
  /** Require an explicit confirmation flag at the protected action boundary. */
  requireConfirmation?: boolean;
  /** Lifecycle hooks keep the provider action tied to the debrief state machine. */
  beforeStart?: (sessionId: string) => Promise<void>;
  onFailure?: (sessionId: string, error: unknown) => Promise<void>;
  onProviderStart?: (sessionId: string, callId: string) => Promise<void>;
  /** Signed Twilio status callbacks are accepted without dashboard/admin auth. */
  statusCallback?: { validator: TwilioSignatureValidator; url: string };
  resolveSessionIdForCallId?: (callId: string) => Promise<string | null>;
  onProviderStatus?: (status: ProviderStatusUpdate) => Promise<void>;
  /** Called exactly once by the media bridge when the provider stream stops. */
  onCallCompleted?: (call: CompletedCallMetadata) => Promise<void>;
}

export type ProviderCallStatus = "queued" | "ringing" | "connected" | "completed" | "failed";

export interface ProviderStatusUpdate {
  callId: string;
  status: ProviderCallStatus;
  rawStatus: string;
  sessionId: string | null;
}

export interface CompletedCallMetadata {
  callId: string | null;
  sessionId: string;
  orgId: string;
  reason: string;
  occurredAt: string;
}

/** Framework-neutral action used by a protected dashboard/MCP layer. */
export async function handleLiveVoiceStart(
  request: VoiceHttpRequest,
  options: LiveVoiceHttpOptions,
): Promise<VoiceHttpResponse> {
  if (request.method.toUpperCase() !== "POST" || request.path !== "/t/voice/live/start") return json(404, { error: "not_found" });
  const body = request.body ?? {};
  const sessionId = stringField(body, "session_id");
  const destination = stringField(body, "to");
  if (options.requireConfirmation && body.confirmation !== true) {
    return json(400, { error: "confirmation_required" });
  }
  if (options.allowedDestinations && !options.allowedDestinations.includes(destination)) {
    return json(403, { error: "destination_not_allowed" });
  }
  const result = await startLiveVoiceCall(sessionId, destination, options);
  return json(202, result);
}

/** Provider-neutral scheduler seam; it uses the exact same start path as the manual local route. */
export async function startScheduledLiveVoiceCall(
  sessionId: string,
  options: LiveVoiceHttpOptions,
): Promise<Awaited<ReturnType<typeof startRealtimeCall>>> {
  const destination = options.allowedDestinations?.[0];
  if (!destination) throw new Error("No allowlisted live voice destination is configured");
  return startLiveVoiceCall(sessionId, destination, options);
}

async function startLiveVoiceCall(
  sessionId: string,
  destination: string,
  options: LiveVoiceHttpOptions,
): Promise<Awaited<ReturnType<typeof startRealtimeCall>>> {
  try {
    await options.beforeStart?.(sessionId);
    const sessionToken = await options.sessionTokenFor(sessionId);
    const result = await startRealtimeCall({
      sessionId, orgId: options.orgId, appId: options.appId, to: destination, from: options.fromNumber,
      mediaStreamUrl: options.mediaStreamUrl, sessionToken, twilio: options.twilio, telemetry: options.telemetry,
      statusCallbackUrl: options.statusCallbackUrl, now: options.now, createId: options.createId,
    });
    await options.onProviderStart?.(sessionId, result.callId);
    return result;
  } catch (error) {
    try { await options.onFailure?.(sessionId, error); } catch { /* Preserve the provider error response. */ }
    throw error;
  }
}

/** Twilio status callback adapter. It only accepts provider metadata, never media or transcript content. */
export async function handleVoiceProviderStatus(
  request: VoiceHttpRequest,
  options: LiveVoiceHttpOptions,
): Promise<VoiceHttpResponse> {
  if (request.method.toUpperCase() !== "POST" || request.path !== "/t/voice/provider-status") return json(404, { error: "not_found" });
  const body = request.body ?? {};
  const params = stringParams(body);
  const signatureInput: TwilioSignatureInput | undefined = options.statusCallback
    ? {
      url: options.statusCallback.url,
      params,
      signature: request.headers?.["x-twilio-signature"] ?? request.headers?.["X-Twilio-Signature"],
    }
    : undefined;
  if (signatureInput && !options.statusCallback!.validator.validate(signatureInput)) return json(403, { error: "invalid_provider_signature" });
  const callId = params.CallSid ?? params.call_sid;
  const rawStatus = (params.CallStatus ?? params.call_status ?? "").toLowerCase();
  if (!callId || !rawStatus) return json(400, { error: "call_sid_and_status_required" });
  const status = normalizeProviderStatus(rawStatus);
  const sessionId = await options.resolveSessionIdForCallId?.(callId) ?? null;
  await options.onProviderStatus?.({ callId, status, rawStatus, sessionId });
  return json(200, { ok: true, call_id: callId, status, session_id: sessionId });
}

export interface TwimlRequestOptions {
  mediaStreamUrl: string;
  sessionTokenField?: string;
}

/** Twilio webhook adapter; the token is placed in Stream custom parameters, not a URL. */
export function handleVoiceTwimlRequest(request: VoiceHttpRequest, options: TwimlRequestOptions): VoiceHttpResponse<string> {
  if (request.method.toUpperCase() !== "POST" || request.path !== "/t/voice/twiml") return xml(404, "<Response><Reject/></Response>");
  const token = stringField(request.body ?? {}, options.sessionTokenField ?? "session_token");
  return { status: 200, headers: { "content-type": "text/xml; charset=utf-8" }, body: generateBidirectionalStreamTwiml({ mediaStreamUrl: options.mediaStreamUrl, sessionToken: token }) };
}

export interface VoiceMediaBridgeOptions {
  socket: VoiceWebSocket;
  signature?: { validator: TwilioSignatureValidator; url: string; params: Readonly<Record<string, string | string[] | undefined>>; value: string | undefined };
  verifier: SignedSessionTokenVerifier;
  openai: { socketFactory: OpenAIRealtimeSocketFactory; url: string; apiKey: string; model: string; instructions?: string; voice?: string };
  routingReason?: string | null;
  instructionsFor?: (binding: SessionBinding) => Promise<string>;
  onCallCompleted?: (call: { sessionId: string; orgId: string; appId: string | null; callId: string | null; reason: string; occurredAt: string }) => Promise<void>;
  telemetry: Pick<TelemetryStore, "append">;
  agent?: Parameters<typeof bridgeTwilioToOpenAI>[0]["agent"];
}

/** Validates the Twilio seam and attaches the bidirectional media bridge. */
export function attachVoiceMediaBridge(options: VoiceMediaBridgeOptions): TwilioOpenAIBridge {
  return bridgeTwilioToOpenAI({
    twilioSocket: options.socket, signature: options.signature, verifier: options.verifier,
    openai: options.openai, routingReason: options.routingReason, telemetry: options.telemetry, agent: options.agent, instructionsFor: options.instructionsFor,
    onCallCompleted: options.onCallCompleted,
  });
}

function stringField(body: Readonly<Record<string, unknown>>, name: string): string {
  const value = body[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value;
}

function stringParams(body: Readonly<Record<string, unknown>>): Record<string, string> {
  return Object.fromEntries(Object.entries(body).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
}

function normalizeProviderStatus(status: string): ProviderCallStatus {
  if (status === "in-progress") return "connected";
  if (status === "busy" || status === "no-answer" || status === "canceled" || status === "failed") return "failed";
  if (status === "completed") return "completed";
  if (status === "ringing") return "ringing";
  return "queued";
}

function json<T>(status: number, body: T): VoiceHttpResponse<T> { return { status, headers: { "content-type": "application/json" }, body }; }
function xml(status: number, body: string): VoiceHttpResponse<string> { return { status, headers: { "content-type": "text/xml; charset=utf-8" }, body }; }

export type { RealtimeCallStartOptions };
