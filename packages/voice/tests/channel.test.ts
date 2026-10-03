import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { z } from "zod";
import { defineKit, defineTool, kit as result, kitAgentTools } from "@kitstackco/sdk";
import { createKitServer, type ServeHandle } from "@kitstackco/sdk/server";
import { createVoiceChannel, type VoiceChannel } from "../src/channel.js";
import type { OpenAIRealtimeSocket } from "../src/realtime.js";

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

const notes: Array<{ session: string; note: string }> = [];
const saveNote = defineTool({
  name: "save_note",
  description: "Save a note from the call",
  mode: "act",
  args: z.object({ session_id: z.string(), note: z.string().min(1) }),
  handler: async (_ctx, args) => { notes.push({ session: args.session_id, note: args.note }); return result.json({ saved: true }); },
});
const notesKit = defineKit({
  id: "notes", version: "0.1.0", name: "Notes", description: "Notes", schema: {},
  migrationSql: "SELECT 1;", instructions: "", tools: [saveNote],
});

describe("voice channel on a KitStack server", () => {
  let handle: ServeHandle | undefined;
  afterEach(async () => { await handle?.close(); handle = undefined; notes.length = 0; });

  async function serveWithChannel() {
    const realtime = new FakeRealtimeSocket();
    const sessions = {
      startSession: vi.fn(async () => ({ orgId: "org-1", appId: null })),
      onCallStarted: vi.fn(async () => undefined),
      onAgentFinished: vi.fn(async () => undefined),
      onCallInterrupted: vi.fn(async () => undefined),
      onCallCompleted: vi.fn(async () => undefined),
    };
    const server = createKitServer({ kit: notesKit, db: { url: ":memory:" }, transport: "http", port: 0 });
    const tools = kitAgentTools({
      kit: notesKit, executor: server, tools: ["save_note"],
      boundArgs: (session) => ({ session_id: session.id }), boundArgNames: ["session_id"],
    });
    const channel: VoiceChannel = createVoiceChannel({
      kitId: "kit:notes",
      telemetry: { append: vi.fn() },
      sessionSecret: "a-voice-channel-test-secret-of-32+bytes",
      realtime: { apiKey: "sk-test", socketFactory: { connect: async () => realtime } },
      localHarness: true,
      briefing: async (call) => ({ content: `Take a note for ${call.sessionId}.`, version: "v1" }),
      tools: { realtime: tools.schemas.map((schema) => ({ type: "function" as const, ...schema })), agent: tools.definitions },
      sessions,
      bargeInMs: 50,
    });
    // The channel calls kit tools through the server, then mounts on it as a plugin.
    server.use(channel);
    handle = await server.listen();
    return { base: `http://127.0.0.1:${handle.port}`, port: handle.port, realtime, sessions, channel };
  }

  it("runs a local call: briefing, kit tool through dispatch, hang-up and session hooks", async () => {
    const { base, port, realtime, sessions } = await serveWithChannel();
    expect((await fetch(`${base}/t/voice/local`)).headers.get("content-type")).toContain("text/html");

    const started = await fetch(`${base}/t/voice/local/start`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: "s-1", confirmation: true }),
    });
    expect(started.status).toBe(202);
    const call = await started.json() as { sessionToken: string; mediaPath: string; callId: string };
    expect(sessions.startSession).toHaveBeenCalledWith("s-1", "local");

    const socket = new WebSocket(`ws://127.0.0.1:${port}${call.mediaPath}`);
    await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (message.event === "mark") socket.send(JSON.stringify({ event: "mark", streamSid: "local", mark: message.mark }));
    });
    socket.send(JSON.stringify({ event: "connected" }));
    socket.send(JSON.stringify({ event: "start", streamSid: "local", start: { streamSid: "local", callSid: call.callId, customParameters: { kitstack_session_token: call.sessionToken } } }));

    await vi.waitFor(() => expect(realtime.sent.find((event) => event.type === "session.update")).toBeTruthy());
    const setup = realtime.sent.find((event) => event.type === "session.update") as any;
    expect(setup.session.instructions).toBe("Take a note for s-1.");
    expect(setup.session.tools.map((tool: { name: string }) => tool.name)).toEqual(["save_note", "end_call"]);
    expect(setup.session.tools[0].parameters.properties).not.toHaveProperty("session_id");

    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.function_call_arguments.done", call_id: "c1", name: "save_note", arguments: JSON.stringify({ note: "Call back Friday" }) });
    realtime.provider({ type: "response.done", response: { usage: {} } });
    await vi.waitFor(() => expect(notes).toEqual([{ session: "s-1", note: "Call back Friday" }]));

    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.function_call_arguments.done", call_id: "c2", name: "end_call", arguments: "{}" });
    realtime.provider({ type: "response.done", response: { usage: {} } });
    await vi.waitFor(() => expect(realtime.sent.some((event) => (event.item as any)?.call_id === "c2")).toBe(true));
    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.done", response: { usage: {} } });

    await closed;
    await vi.waitFor(() => expect(sessions.onAgentFinished).toHaveBeenCalledWith("s-1"));
    expect(sessions.onCallCompleted).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "s-1", reason: "agent_hangup" }));
    expect(sessions.onCallInterrupted).not.toHaveBeenCalled();
  });

  it("does not expose phone routes unless phone calls are configured", async () => {
    const { base, channel } = await serveWithChannel();
    expect(channel.capabilities.phone).toBeUndefined();
    expect((await fetch(`${base}/t/voice/live/start`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status).toBe(404);
  });

  it("denies phone starts unless the kit authorizes them", () => {
    const channel = createVoiceChannel({
      kitId: "kit:notes", telemetry: { append: vi.fn() }, sessionSecret: "a-voice-channel-test-secret-of-32+bytes",
      realtime: { apiKey: "sk-test" },
      phone: { accountSid: "AC1", authToken: "t", fromNumber: "+4915100000000", publicUrl: "https://example.test", allowedDestinations: ["+4917600000000"] },
      briefing: async () => ({ content: "", version: "v" }),
      tools: { realtime: [], agent: [] },
      sessions: { startSession: vi.fn(), onAgentFinished: vi.fn(), onCallInterrupted: vi.fn() },
    });
    const start = channel.routes.find((route) => route.path === "/t/voice/live/start")!;
    return expect(Promise.resolve(start.handler({ method: "POST", path: "/t/voice/live/start", query: {}, headers: {}, body: {}, raw: {} as never })))
      .resolves.toMatchObject({ status: 403 });
  });
});
