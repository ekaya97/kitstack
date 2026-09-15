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
  type VoiceWebSocket,
  type SessionBinding,
} from "../voice/realtime.js";
import type { TelemetryStore } from "../telemetry/index.js";

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
  try {
    await options.beforeStart?.(sessionId);
    const sessionToken = await options.sessionTokenFor(sessionId);
    const result = await startRealtimeCall({
      sessionId, orgId: options.orgId, appId: options.appId, to: destination, from: options.fromNumber,
      mediaStreamUrl: options.mediaStreamUrl, sessionToken, twilio: options.twilio, telemetry: options.telemetry,
      statusCallbackUrl: options.statusCallbackUrl, now: options.now, createId: options.createId,
    });
    return json(202, result);
  } catch (error) {
    try { await options.onFailure?.(sessionId, error); } catch { /* Preserve the provider error response. */ }
    throw error;
  }
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
  instructionsFor?: (binding: SessionBinding) => Promise<string>;
  telemetry: Pick<TelemetryStore, "append">;
  agent?: Parameters<typeof bridgeTwilioToOpenAI>[0]["agent"];
}

/** Validates the Twilio seam and attaches the bidirectional media bridge. */
export function attachVoiceMediaBridge(options: VoiceMediaBridgeOptions): TwilioOpenAIBridge {
  return bridgeTwilioToOpenAI({
    twilioSocket: options.socket, signature: options.signature, verifier: options.verifier,
    openai: options.openai, telemetry: options.telemetry, agent: options.agent, instructionsFor: options.instructionsFor,
  });
}

function stringField(body: Readonly<Record<string, unknown>>, name: string): string {
  const value = body[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value;
}

function json<T>(status: number, body: T): VoiceHttpResponse<T> { return { status, headers: { "content-type": "application/json" }, body }; }
function xml(status: number, body: string): VoiceHttpResponse<string> { return { status, headers: { "content-type": "text/xml; charset=utf-8" }, body }; }

export type { RealtimeCallStartOptions };
