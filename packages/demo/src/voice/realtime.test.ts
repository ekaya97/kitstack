import { describe, expect, it, vi } from "vitest";
import {
  bridgeTwilioToOpenAI,
  createOpenAIRealtimeSession,
  createSessionBindingStore,
  createTwilioCallsClient,
  createTwilioSignatureValidator,
  generateBidirectionalStreamTwiml,
  startRealtimeCall,
  type OpenAIRealtimeSocket,
  type VoiceWebSocket,
} from "./realtime.js";

class FakeSocket implements VoiceWebSocket, OpenAIRealtimeSocket {
  readonly sent: string[] = [];
  readonly closed: Array<{ code?: number; reason?: string }> = [];
  private readonly listeners = new Map<string, Array<(...args: any[]) => void>>();

  send(data: string): void { this.sent.push(data); }
  close(code?: number, reason?: string): void { this.closed.push({ code, reason }); }
  on(event: string, listener: (...args: any[]) => void): this { this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]); return this; }
  once(event: string, listener: (...args: any[]) => void): this { return this.on(event, listener); }
  emit(event: string, ...args: any[]): void { for (const listener of this.listeners.get(event) ?? []) listener(...args); }
}

function telemetry() {
  return { append: vi.fn(async (event: any) => event) };
}

describe("Twilio and OpenAI Realtime boundary", () => {
  it("generates bidirectional μ-law TwiML and escapes the custom token", () => {
    const twiml = generateBidirectionalStreamTwiml({ mediaStreamUrl: "wss://demo.example/media", sessionToken: "signed&token\"" });
    expect(twiml).toContain("<Connect>");
    expect(twiml).toContain("<Stream url=\"wss://demo.example/media\">");
    expect(twiml).toContain("value=\"signed&amp;token&quot;\"");
    expect(twiml).not.toContain("<Record");
  });

  it("requires a public WSS stream and never invents a live configuration", () => {
    expect(() => generateBidirectionalStreamTwiml({ mediaStreamUrl: "http://localhost/media", sessionToken: "token" })).toThrow(/wss/);
    expect(() => generateBidirectionalStreamTwiml({ mediaStreamUrl: "wss://demo.example/media", sessionToken: "" })).toThrow(/session token/);
  });

  it("places an outbound call through the injected Twilio client and sends Record=false", async () => {
    const fetcher = vi.fn(async (_input: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: expect.stringContaining("Basic ") });
      expect(String(init?.body)).toContain("Record=false");
      return new Response(JSON.stringify({ sid: "CA123", status: "queued" }), { status: 201 });
    });
    const twilio = createTwilioCallsClient({ accountSid: "AC123", authToken: "secret", fetch: fetcher });
    const result = await startRealtimeCall({
      sessionId: "session-1", orgId: "org-demo", appId: "app-sales", to: "+491234567890", from: "+491234567891",
      mediaStreamUrl: "wss://demo.example/media", sessionToken: "signed-session", twilio, telemetry: telemetry(),
      createId: () => "event-1", now: () => "2026-01-01T00:00:00.000Z",
    });
    expect(result).toMatchObject({ callId: "CA123", provider: "twilio-openai-realtime", status: "connecting", recording: false, retention: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects non-E.164 destinations before calling Twilio", async () => {
    const twilio = { createCall: vi.fn() };
    await expect(startRealtimeCall({
      sessionId: "session-1", orgId: "org-demo", appId: null, to: "0049123", from: "+491234567891",
      mediaStreamUrl: "wss://demo.example/media", sessionToken: "signed-session", twilio, telemetry: telemetry(),
    })).rejects.toThrow(/E.164/);
    expect(twilio.createCall).not.toHaveBeenCalled();
  });

  it("sets OpenAI PCMU session format before forwarding audio", async () => {
    const socket = new FakeSocket();
    const session = await createOpenAIRealtimeSession({
      socketFactory: { connect: vi.fn(async () => socket) }, url: "wss://api.openai.example/realtime",
      apiKey: "server-only-key", model: "gpt-4o-realtime-preview", instructions: "German sales", voice: "alloy",
    });
    expect(JSON.parse(socket.sent[0])).toMatchObject({ type: "session.update", session: { input_audio_format: "g711_ulaw", output_audio_format: "g711_ulaw" } });
    session.sendAudio("AQID");
    expect(JSON.parse(socket.sent[1])).toEqual({ type: "input_audio_buffer.append", audio: "AQID" });
  });

  it("binds the signed session and forwards media in both directions", async () => {
    const twilio = new FakeSocket();
    const openai = new FakeSocket();
    const store = telemetry();
    const agent = { onProviderTurn: vi.fn(async () => undefined), onInterruption: vi.fn(async () => undefined), onStop: vi.fn(async () => undefined), onError: vi.fn(async () => undefined) };
    const bridge = bridgeTwilioToOpenAI({
      twilioSocket: twilio,
      openai: { socketFactory: { connect: vi.fn(async () => openai) }, url: "wss://openai.example/realtime", apiKey: "server-key", model: "gpt-4o-realtime-preview" },
      verifier: { verify: vi.fn(async (token: string) => { expect(token).toBe("signed-session"); return { sessionId: "session-1", orgId: "org-demo", appId: "app-sales" }; }) },
      bindings: createSessionBindingStore(), telemetry: store, agent, now: () => "2026-01-01T00:00:00.000Z", createId: (() => { let i = 0; return () => `event-${++i}`; })(),
    });
    twilio.emit("message", JSON.stringify({ event: "start", streamSid: "MZ123", start: { streamSid: "MZ123", callSid: "CA123", customParameters: { kitstack_session_token: "signed-session" } } }));
    await expect(bridge.binding).resolves.toMatchObject({ streamSid: "MZ123", sessionId: "session-1" });
    expect(JSON.parse(openai.sent[0])).toMatchObject({ type: "session.update" });

    twilio.emit("message", JSON.stringify({ event: "media", streamSid: "MZ123", media: { payload: "AQID" } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.parse(openai.sent[1])).toEqual({ type: "input_audio_buffer.append", audio: "AQID" });
    openai.emit("message", JSON.stringify({ type: "response.audio.delta", delta: "BAUG" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.parse(twilio.sent.at(-1)!)).toEqual({ event: "media", streamSid: "MZ123", media: { payload: "BAUG" } });

    openai.emit("message", JSON.stringify({ type: "input_audio_buffer.speech_started" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(openai.sent.some((value) => JSON.parse(value).type === "response.cancel")).toBe(true);
    expect(JSON.parse(twilio.sent.at(-1)!)).toEqual({ event: "clear", streamSid: "MZ123" });
    expect(agent.onInterruption).toHaveBeenCalledOnce();

    openai.emit("message", JSON.stringify({ type: "response.created" }));
    openai.emit("message", JSON.stringify({ type: "response.done", response: { usage: { input_tokens: 12, output_tokens: 8 } } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(agent.onProviderTurn).toHaveBeenCalledWith(expect.objectContaining({ kind: "turn_completed", sessionId: "session-1", usage: { inputTokens: 12, outputTokens: 8 } }));
    expect(store.append).toHaveBeenCalledWith(expect.objectContaining({ type: "inference", model: "gpt-4o-realtime-preview", requestTokens: 12, responseTokens: 8 }));

    twilio.emit("message", JSON.stringify({ event: "stop", streamSid: "MZ123" }));
    await bridge.done;
    expect(agent.onStop).toHaveBeenCalledWith("twilio_stop");
    expect(JSON.stringify(store.append.mock.calls)).not.toMatch(/AQID|BAUG|transcript|audio/i);
  });

  it("rejects an invalid Twilio signature and does not open OpenAI", async () => {
    const twilio = new FakeSocket();
    const connect = vi.fn();
    const bridge = bridgeTwilioToOpenAI({
      twilioSocket: twilio,
      signature: { validator: { validate: () => false }, url: "https://demo.example/media", params: {}, value: "bad" },
      openai: { socketFactory: { connect }, url: "wss://openai.example/realtime", apiKey: "key", model: "model" },
      verifier: { verify: vi.fn() }, telemetry: telemetry(),
    });
    await expect(bridge.binding).rejects.toThrow(/signature/);
    expect(connect).not.toHaveBeenCalled();
    expect(twilio.closed[0]).toMatchObject({ code: 1008 });
  });

  it("implements Twilio signature validation with the injected auth token", () => {
    const validator = createTwilioSignatureValidator("auth-token");
    expect(validator.validate({ url: "https://demo.example/voice", params: { CallSid: "CA123", From: "+49123" }, signature: "invalid" })).toBe(false);
  });
});
