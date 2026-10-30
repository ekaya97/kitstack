import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { createDemoServer, type DemoServer } from "./server.js";
import type { OpenAIRealtimeSocket, OpenAIRealtimeSocketFactory } from "@kitstackco/voice";
import { kitCall, kitView } from "./test-support.js";

const AUTH_TOKEN = "twilio-test-auth-token";
const ADMIN_TOKEN = "admin-test-token";
const DESTINATION = "+4917600000000";
const MEDIA_URL = "wss://voice.test/t/voice/media";

const LIVE_ENV = {
  TWILIO_ACCOUNT_SID: "ACtest",
  TWILIO_AUTH_TOKEN: AUTH_TOKEN,
  TWILIO_FROM_NUMBER: "+4915100000000",
  OPENAI_API_KEY: "sk-test",
  KITSTACK_DEMO_PUBLIC_HTTPS_URL: "https://voice.test",
  KITSTACK_DEMO_PUBLIC_WSS_URL: MEDIA_URL,
  KITSTACK_DEMO_ALLOWED_DESTINATION: DESTINATION,
  KITSTACK_DEMO_ADMIN_TOKEN: ADMIN_TOKEN,
  KITSTACK_VOICE_BARGE_IN_MS: "50",
};
// About one second of μ-law audio (8000 bytes).
const ONE_SECOND_AUDIO = Buffer.alloc(8000, 0xff).toString("base64");

/** In-process stand-in for the OpenAI Realtime socket; the test drives its events. */
class FakeRealtimeSocket implements OpenAIRealtimeSocket {
  readonly sent: Array<Record<string, unknown>> = [];
  closed = false;
  private readonly listeners = new Map<string, Array<(...args: any[]) => void>>();
  send(data: string): void { this.sent.push(JSON.parse(data)); }
  close(): void { this.closed = true; this.emit("close"); }
  on(event: string, listener: (...args: any[]) => void): this { this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]); return this; }
  once(event: string, listener: (...args: any[]) => void): this { return this.on(event, listener); }
  off(): this { return this; }
  emit(event: string, ...args: any[]): void { for (const listener of this.listeners.get(event) ?? []) listener(...args); }
  provider(event: Record<string, unknown>): void { this.emit("message", JSON.stringify(event)); }
}

async function mcp(base: string, name: string, args: Record<string, unknown>) {
  const params = name === "kit_view"
    ? kitView(String(args.view))
    : kitCall(name, args);
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params }),
  });
  const body = await response.json() as any;
  const result = body.result ?? body;
  return result.structuredContent ?? JSON.parse(result.content?.[0]?.text ?? "null") ?? result;
}

describe("live voice call over real HTTP and WebSocket", () => {
  let server: DemoServer | undefined;
  let port = 0;
  let realtime: FakeRealtimeSocket;
  let twiml = "";
  const previousEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const [key, value] of Object.entries(LIVE_ENV)) { previousEnv[key] = process.env[key]; process.env[key] = value; }
    realtime = new FakeRealtimeSocket();
    twiml = "";
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  async function startCall() {
    const openaiSocketFactory: OpenAIRealtimeSocketFactory = { connect: async () => realtime };
    realtime = new FakeRealtimeSocket();
    const twilioFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      twiml = new URLSearchParams(String(init?.body)).get("Twiml") ?? "";
      return new Response(JSON.stringify({ sid: "CAtest", status: "queued" }), { status: 201 });
    }) as unknown as typeof fetch;
    if (!server) {
      server = await createDemoServer({ port: 0, liveVoiceProviders: { openaiSocketFactory, twilioFetch } });
      port = (await server.listen()).port;
    }
    const base = `http://127.0.0.1:${port}`;

    const prepared = await mcp(base, "prepare_debrief", {
      goal: "Debrief the store visit", company: "Test GmbH", contact_name: "Anna Test", location: "Köln",
      callback_at: new Date(Date.now() + 6 * 3600_000).toISOString(), callback_timezone: "Europe/Berlin",
    });
    const sessionId = prepared.sessionId ?? prepared.session_id ?? prepared.session?.sessionId;
    expect(sessionId).toBeTruthy();

    const started = await fetch(`${base}/t/voice/live/start`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-demo-admin-token": ADMIN_TOKEN },
      body: JSON.stringify({ session_id: sessionId, to: DESTINATION, confirmation: true }),
    });
    expect(started.status).toBe(202);
    const token = /name="kitstack_session_token" value="([^"]+)"/.exec(twiml)?.[1];
    expect(token).toBeTruthy();

    const signature = createHmac("sha1", AUTH_TOKEN).update(MEDIA_URL).digest("base64");
    const twilio = new WebSocket(`ws://127.0.0.1:${port}/t/voice/media`, { headers: { "x-twilio-signature": signature } });
    await new Promise((resolve, reject) => { twilio.once("open", resolve); twilio.once("error", reject); });
    twilio.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
    twilio.send(JSON.stringify({
      event: "start", sequenceNumber: "1", streamSid: "MZtest",
      start: { streamSid: "MZtest", callSid: "CAtest", customParameters: { kitstack_session_token: token } },
    }));
    await vi.waitFor(() => expect(realtime.sent.some((event) => event.type === "response.create")).toBe(true));
    return { base, sessionId: sessionId as string, twilio };
  }

  async function talk(base: string, sessionId: string) {
    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.done", response: { usage: { input_tokens: 10, output_tokens: 5 } } });
    realtime.provider({ type: "response.created" });
    realtime.provider({
      type: "response.function_call_arguments.done", call_id: "call-1", name: "update_debrief_draft",
      arguments: JSON.stringify({ outcome: "Order agreed", next_step: "Send offer" }),
    });
    realtime.provider({ type: "response.done", response: { usage: { input_tokens: 12, output_tokens: 6 } } });
    await vi.waitFor(() => expect(realtime.sent.some((event) => (event.item as any)?.type === "function_call_output")).toBe(true));
    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.done", response: { usage: { input_tokens: 14, output_tokens: 7 } } });
    // A response is still in flight when the caller hangs up.
    realtime.provider({ type: "response.created" });
    void base; void sessionId;
  }

  it("finalizes the session for confirmation when Twilio sends stop", async () => {
    const { base, sessionId, twilio } = await startCall();
    await talk(base, sessionId);
    twilio.send(JSON.stringify({ event: "stop", streamSid: "MZtest", stop: { callSid: "CAtest" } }));
    twilio.close();

    await vi.waitFor(async () => expect((await mcp(base, "get_session", { session_id: sessionId })).state).toBe("awaiting_confirmation"), { timeout: 3000 });
    expect(realtime.closed).toBe(true);
    const confirmation = await mcp(base, "get_debrief_for_confirmation", { session_id: sessionId });
    expect(JSON.stringify(confirmation)).toContain("Order agreed");
  });

  it("lets the agent end the call after its goodbye has played", async () => {
    const { base, sessionId, twilio } = await startCall();
    const marks: string[] = [];
    const closed = new Promise<number>((resolve) => twilio.once("close", (code) => resolve(code)));
    twilio.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (message.event !== "mark") return;
      marks.push(message.mark.name);
      // Twilio echoes the mark once the audio queued before it has played.
      twilio.send(JSON.stringify({ event: "mark", streamSid: "MZtest", mark: { name: message.mark.name } }));
    });
    await talk(base, sessionId);
    realtime.provider({ type: "response.done", response: { usage: {} } });
    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.function_call_arguments.done", call_id: "call-end", name: "end_call", arguments: "{}" });
    realtime.provider({ type: "response.done", response: { usage: {} } });
    await vi.waitFor(() => expect(realtime.sent.some((event) => (event.item as any)?.call_id === "call-end")).toBe(true));
    expect(marks).toEqual([]);

    // The goodbye response that follows the tool result.
    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.output_audio.delta", delta: "AAAA" });
    realtime.provider({ type: "response.done", response: { usage: {} } });

    expect(await closed).toBe(1000);
    expect(marks).toEqual(["kitstack-hangup-1"]);
    await vi.waitFor(async () => expect((await mcp(base, "get_session", { session_id: sessionId })).state).toBe("awaiting_confirmation"), { timeout: 3000 });
    expect(realtime.closed).toBe(true);
  });

  it("does not hang up mid-sentence when the caller interrupts the goodbye", async () => {
    const { base, sessionId, twilio } = await startCall();
    const marks: string[] = [];
    let closedCode: number | undefined;
    const closed = new Promise<number>((resolve) => twilio.once("close", (code) => { closedCode = code; resolve(code); }));
    twilio.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (message.event === "mark") marks.push(message.mark.name);
      // Twilio answers `clear` by echoing every pending mark immediately.
      if (message.event === "clear") for (const name of marks) twilio.send(JSON.stringify({ event: "mark", streamSid: "MZtest", mark: { name } }));
    });
    await talk(base, sessionId);
    realtime.provider({ type: "response.done", response: { usage: {} } });
    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.function_call_arguments.done", call_id: "call-end", name: "end_call", arguments: "{}" });
    realtime.provider({ type: "response.done", response: { usage: {} } });
    await vi.waitFor(() => expect(realtime.sent.some((event) => (event.item as any)?.call_id === "call-end")).toBe(true));
    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.output_audio.delta", delta: ONE_SECOND_AUDIO });
    realtime.provider({ type: "response.done", response: { usage: {} } });
    await vi.waitFor(() => expect(marks).toEqual(["kitstack-hangup-1"]));

    // The caller talks over the goodbye: the echoed mark must not end the call.
    realtime.provider({ type: "input_audio_buffer.speech_started" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(closedCode).toBeUndefined();
    realtime.provider({ type: "input_audio_buffer.speech_stopped" });
    realtime.provider({ type: "input_audio_buffer.committed", item_id: "item-caller" });

    // The agent answers; the call ends once that reply has played.
    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.done", response: { usage: {} } });
    await vi.waitFor(() => expect(marks).toEqual(["kitstack-hangup-1", "kitstack-hangup-2"]));
    twilio.send(JSON.stringify({ event: "mark", streamSid: "MZtest", mark: { name: "kitstack-hangup-2" } }));
    expect(await closed).toBe(1000);
    await vi.waitFor(async () => expect((await mcp(base, "get_session", { session_id: sessionId })).state).toBe("awaiting_confirmation"), { timeout: 3000 });
  });

  it("keeps talking through a short noise but stops for sustained speech", async () => {
    const { base, sessionId, twilio } = await startCall();
    const fromServer: Array<Record<string, any>> = [];
    twilio.on("message", (raw) => fromServer.push(JSON.parse(String(raw))));
    await talk(base, sessionId);
    realtime.provider({ type: "response.output_audio.delta", delta: ONE_SECOND_AUDIO });
    realtime.provider({ type: "response.done", response: { usage: {} } });
    const responsesBefore = realtime.sent.filter((event) => event.type === "response.create").length;

    // A blip shorter than the barge-in window while the agent's audio plays.
    realtime.provider({ type: "input_audio_buffer.speech_started" });
    realtime.provider({ type: "input_audio_buffer.speech_stopped" });
    realtime.provider({ type: "input_audio_buffer.committed", item_id: "item-noise" });
    await vi.waitFor(() => expect(realtime.sent).toContainEqual({ type: "conversation.item.delete", item_id: "item-noise" }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fromServer.some((message) => message.event === "clear")).toBe(false);
    expect(realtime.sent.filter((event) => event.type === "response.create")).toHaveLength(responsesBefore);

    // The caller keeps talking: the agent stops and answers afterwards.
    realtime.provider({ type: "input_audio_buffer.speech_started" });
    await vi.waitFor(() => expect(fromServer.some((message) => message.event === "clear")).toBe(true));
    realtime.provider({ type: "input_audio_buffer.speech_stopped" });
    realtime.provider({ type: "input_audio_buffer.committed", item_id: "item-caller" });
    await vi.waitFor(() => expect(realtime.sent.filter((event) => event.type === "response.create")).toHaveLength(responsesBefore + 1));
  });

  it("answers the caller when they speak after the agent has finished", async () => {
    const { base, sessionId } = await startCall();
    await talk(base, sessionId);
    realtime.provider({ type: "response.done", response: { usage: {} } });
    const responsesBefore = realtime.sent.filter((event) => event.type === "response.create").length;
    realtime.provider({ type: "input_audio_buffer.speech_started" });
    realtime.provider({ type: "input_audio_buffer.speech_stopped" });
    realtime.provider({ type: "input_audio_buffer.committed", item_id: "item-answer" });
    await vi.waitFor(() => expect(realtime.sent.filter((event) => event.type === "response.create")).toHaveLength(responsesBefore + 1));
    expect(realtime.sent).not.toContainEqual({ type: "conversation.item.delete", item_id: "item-answer" });
  });

  it("briefs the next call with the facts confirmed in the previous one", async () => {
    const first = await startCall();
    await talk(first.base, first.sessionId);
    first.twilio.send(JSON.stringify({ event: "stop", streamSid: "MZtest", stop: { callSid: "CAtest" } }));
    await vi.waitFor(async () => expect((await mcp(first.base, "get_session", { session_id: first.sessionId })).state).toBe("awaiting_confirmation"), { timeout: 3000 });
    await mcp(first.base, "confirm_debrief_draft", { session_id: first.sessionId });
    const timeline = await mcp(first.base, "kit_view", { id: "debrief", view: "customer-timeline" });
    expect(JSON.stringify(timeline)).toContain("Order agreed");

    const second = await startCall();
    expect(second.sessionId).not.toBe(first.sessionId);
    const update = realtime.sent.find((event) => event.type === "session.update") as any;
    expect(update.session.instructions).toContain("Previous confirmed debriefs with this customer");
    expect(update.session.instructions).toContain("outcome: Order agreed; next step: Send offer");
    // The caller is told the debrief is only saved once confirmed in Claude.
    expect(update.session.instructions).toMatch(/nothing is saved[^.]*\./i);
    expect(update.session.instructions).toContain("open Claude");
  });

  it("keeps saved facts reviewable when the provider fails mid-call", async () => {
    const { base, sessionId } = await startCall();
    await talk(base, sessionId);
    realtime.provider({ type: "error", error: { code: "server_error", message: "upstream failure" } });

    await vi.waitFor(async () => expect((await mcp(base, "get_session", { session_id: sessionId })).state).toBe("awaiting_confirmation"), { timeout: 3000 });
    const confirmation = await mcp(base, "get_debrief_for_confirmation", { session_id: sessionId });
    expect(confirmation.draft.fields).toMatchObject({ outcome: "Order agreed", next_step: "Send offer" });
  });

  it("finalizes the session when the Twilio socket closes without a stop event", async () => {
    const { base, sessionId, twilio } = await startCall();
    await talk(base, sessionId);
    twilio.terminate();

    await vi.waitFor(async () => expect((await mcp(base, "get_session", { session_id: sessionId })).state).toBe("awaiting_confirmation"), { timeout: 3000 });
    expect(realtime.closed).toBe(true);
  });
});
