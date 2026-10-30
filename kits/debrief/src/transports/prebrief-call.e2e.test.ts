import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { createDemoServer, type DemoServer } from "./server.js";
import type { OpenAIRealtimeSocket, OpenAIRealtimeSocketFactory } from "@kitstackco/voice";
import { kitCall, kitView } from "./test-support.js";

// The self-service phone guard requires either a verified owner number or
// the operator fallback destination; these tests use the latter, as the
// live-voice phone tests do.
const LOCAL_ENV = { OPENAI_API_KEY: "sk-test", KITSTACK_DEMO_ALLOWED_DESTINATION: "+4917600000000" };

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
  const params = name === "kit_view" ? kitView(String(args.view)) : kitCall(name, args);
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params }),
  });
  const body = await response.json() as any;
  const result = body.result ?? body;
  return result.structuredContent ?? JSON.parse(result.content?.[0]?.text ?? "null") ?? result;
}

describe("the optional prebrief call, over the local voice harness", () => {
  let server: DemoServer | undefined;
  let port = 0;
  let realtime: FakeRealtimeSocket;
  const previousEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const [key, value] of Object.entries(LOCAL_ENV)) { previousEnv[key] = process.env[key]; process.env[key] = value; }
    realtime = new FakeRealtimeSocket();
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  /** Prepares a session with both a debrief and a prebrief call scheduled. */
  async function prepareWithPrebrief(goal = "Close the renewal") {
    const openaiSocketFactory: OpenAIRealtimeSocketFactory = { connect: async () => realtime };
    realtime = new FakeRealtimeSocket();
    if (!server) {
      server = await createDemoServer({ port: 0, liveVoiceProviders: { openaiSocketFactory } });
      port = (await server.listen()).port;
    }
    const base = `http://127.0.0.1:${port}`;
    const callbackAt = new Date(Date.now() + 2 * 3600_000).toISOString();
    const prebriefCallAt = new Date(Date.now() + 3600_000).toISOString();
    const prepared = await mcp(base, "prepare_debrief", {
      goal, company: "Acme Corp", contact_name: "Anna Test", location: "Köln",
      callback_at: callbackAt, callback_timezone: "Europe/Berlin", prebrief_call_at: prebriefCallAt,
    });
    const sessionId = prepared.sessionId ?? prepared.session_id;
    expect(sessionId).toBeTruthy();
    expect(prepared.prebrief_call_at ?? prepared.prebriefCallAt).toBe(prebriefCallAt);
    return { base, sessionId: sessionId as string, prebriefCallAt, callbackAt };
  }

  let callCounter = 0;

  /**
   * Starts a local-harness call of the given purpose and waits for the
   * model's instructions. A single FakeRealtimeSocket is reused for every
   * call in a test (one real OpenAI session per call, over one transport),
   * so every assertion is scoped to events sent from this call onward.
   */
  async function startLocalCall(base: string, sessionId: string, purpose?: "prebrief") {
    const since = realtime.sent.length;
    const started = await fetch(`${base}/t/voice/local/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, confirmation: true, ...(purpose ? { purpose } : {}) }),
    });
    expect(started.status).toBe(202);
    const call = await started.json() as { sessionToken: string; mediaPath: string; callId: string };
    const socket = new WebSocket(`ws://127.0.0.1:${port}${call.mediaPath}`);
    await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    // Echo the agent's hang-up mark back, as a real media stream would, so
    // end_call actually drops the line instead of waiting for its timeout.
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (message.event === "mark") socket.send(JSON.stringify({ event: "mark", streamSid: "local", mark: message.mark }));
    });
    socket.send(JSON.stringify({ event: "connected" }));
    socket.send(JSON.stringify({
      event: "start", streamSid: "local", start: { streamSid: "local", callSid: call.callId, customParameters: { kitstack_session_token: call.sessionToken } },
    }));
    await vi.waitFor(() => expect(realtime.sent.slice(since).find((event) => event.type === "session.update")).toBeTruthy());
    const setup = realtime.sent.slice(since).find((event) => event.type === "session.update") as any;
    return { socket, closed, since, instructions: setup.session.instructions as string, tools: (setup.session.tools as Array<{ name: string }>).map((t) => t.name) };
  }

  async function callToolAndEndCall(
    call: { socket: WebSocket; closed: Promise<void>; since: number },
    toolName: string,
    args: Record<string, unknown>,
  ) {
    const toolCallId = `tool-call-${++callCounter}`;
    const hangupCallId = `hangup-call-${++callCounter}`;
    const sentSince = () => realtime.sent.slice(call.since);
    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.function_call_arguments.done", call_id: toolCallId, name: toolName, arguments: JSON.stringify(args) });
    realtime.provider({ type: "response.done", response: { usage: {} } });
    await vi.waitFor(() => expect(sentSince().some((event) => (event.item as any)?.call_id === toolCallId)).toBe(true));

    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.function_call_arguments.done", call_id: hangupCallId, name: "end_call", arguments: "{}" });
    realtime.provider({ type: "response.done", response: { usage: {} } });
    await vi.waitFor(() => expect(sentSince().some((event) => (event.item as any)?.call_id === hangupCallId)).toBe(true));

    realtime.provider({ type: "response.created" });
    realtime.provider({ type: "response.done", response: { usage: {} } });
    await call.closed;
  }

  it("briefs the prebrief call with customer context and only the save_meeting_plan tool", async () => {
    const { base, sessionId } = await prepareWithPrebrief();
    const { instructions, tools } = await startLocalCall(base, sessionId, "prebrief");

    expect(tools).toEqual(["save_meeting_plan", "end_call"]);
    expect(instructions).toContain("Acme Corp");
    expect(instructions).toContain("Close the renewal");
  });

  it("saves the meeting plan, leaves the session prepared, and keeps the debrief call scheduled", async () => {
    const { base, sessionId } = await prepareWithPrebrief();
    const call = await startLocalCall(base, sessionId, "prebrief");

    const plan = "Push for a 2-year contract and address the support SLA concern.";
    await callToolAndEndCall(call, "save_meeting_plan", { plan });

    expect((await mcp(base, "get_session", { session_id: sessionId })).state).toBe("prepared");
    const jobs = (await server!.app.scheduler.list(server!.app.orgId)).filter((job) => job.sessionId === sessionId);
    expect(jobs.map((job) => job.purpose).sort()).toEqual(["debrief", "prebrief"]);
    expect(jobs.find((job) => job.purpose === "debrief")?.status).toBe("scheduled");

    const timeline = await mcp(base, "kit_view", { id: "debrief", view: "customer-timeline" });
    expect(JSON.stringify(timeline)).toContain(plan);
  });

  it("carries the saved meeting plan into the later debrief call's briefing", async () => {
    const { base, sessionId } = await prepareWithPrebrief();
    const first = await startLocalCall(base, sessionId, "prebrief");
    const plan = "Confirm pricing and get a signature this week.";
    await callToolAndEndCall(first, "save_meeting_plan", { plan });

    const debriefCall = await startLocalCall(base, sessionId);
    expect(debriefCall.tools).toEqual(["get_debrief_draft", "update_debrief_draft", "end_call"]);
    expect(debriefCall.instructions).toContain("The rep planned");
    expect(debriefCall.instructions).toContain(plan);
    expect(debriefCall.instructions).toContain("Ask how it went against that plan");

    await callToolAndEndCall(debriefCall, "update_debrief_draft", { outcome: "Signed" });
    expect((await mcp(base, "get_session", { session_id: sessionId })).state).toBe("awaiting_confirmation");
  });

  it("does not cancel the scheduled debrief call when the prebrief call fails", async () => {
    const { base, sessionId } = await prepareWithPrebrief();
    const { closed } = await startLocalCall(base, sessionId, "prebrief");

    realtime.provider({ type: "error", error: { code: "server_error", message: "upstream failure" } });
    await closed;

    expect((await mcp(base, "get_session", { session_id: sessionId })).state).toBe("prepared");
    const jobs = (await server!.app.scheduler.list(server!.app.orgId)).filter((job) => job.sessionId === sessionId);
    expect(jobs.find((job) => job.purpose === "debrief")).toMatchObject({ status: "scheduled" });
    expect(jobs.find((job) => job.purpose === "prebrief")).toMatchObject({ status: "scheduled" });
  });

  it("leaves a debrief-only session (no prebrief_call_at) behaving exactly as before", async () => {
    const openaiSocketFactory: OpenAIRealtimeSocketFactory = { connect: async () => realtime };
    realtime = new FakeRealtimeSocket();
    server = await createDemoServer({ port: 0, liveVoiceProviders: { openaiSocketFactory } });
    port = (await server.listen()).port;
    const base = `http://127.0.0.1:${port}`;
    const prepared = await mcp(base, "prepare_debrief", {
      goal: "Debrief the store visit", company: "Test GmbH", contact_name: "Anna Test", location: "Köln",
      callback_at: new Date(Date.now() + 6 * 3600_000).toISOString(), callback_timezone: "Europe/Berlin",
    });
    const sessionId = (prepared.sessionId ?? prepared.session_id) as string;
    expect(prepared.prebrief_call_at).toBeUndefined();
    expect((await server.app.scheduler.list(server.app.orgId)).filter((job) => job.sessionId === sessionId)).toHaveLength(1);

    const call = await startLocalCall(base, sessionId);
    expect(call.tools).toEqual(["get_debrief_draft", "update_debrief_draft", "end_call"]);
    expect(call.instructions).not.toContain("save_meeting_plan");
    await callToolAndEndCall(call, "update_debrief_draft", { outcome: "Order agreed" });
    expect((await mcp(base, "get_session", { session_id: sessionId })).state).toBe("awaiting_confirmation");
  });
});
