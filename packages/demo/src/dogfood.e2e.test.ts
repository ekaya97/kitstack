import { afterEach, describe, expect, it } from "vitest";
import { createDemoApp, type DemoApp } from "./app/index.js";
import { handleDemoAppRequest, type DemoAppRouteRequest } from "./http/app.js";

let app: DemoApp | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("T-0158 sales voice demo dogfood", () => {
  it("replays a taught prebrief across two voice runs and resets repeatably", async () => {
    app = await createDemoApp({ url: ":memory:" });

    const registered = await request({
      method: "POST",
      path: "/v1/apps/register",
      body: { name: "Claude dogfood", org: app.orgId, scopes: ["inference"] },
    });
    expect(registered.status).toBe(201);
    const appId = field<string>(registered.body, "id");

    const issued = await request({ method: "POST", path: `/v1/apps/${appId}/token` });
    expect(issued.status).toBe(200);
    const token = field<string>(issued.body, "token");

    const first = await callTool<{ sessionId: string; state: string; instructionVersion: string; memoryIds: string[] }>(
      1,
      "prepare_debrief",
      { goal: "Improve German sales qualification" },
    );
    expect(first.state).toBe("prepared");
    expect(first.memoryIds).toEqual([]);
    expect(first.instructionVersion).toMatch(/^sha256:[a-f0-9]{64}$/);

    const firstStart = await callTool<{ sessionId: string; provider: string; status: string }>(
      2,
      "start_voice_call",
      { session_id: first.sessionId },
    );
    expect(firstStart).toMatchObject({
      sessionId: first.sessionId,
      provider: "simulator",
      locale: "de-DE",
      recording: false,
      retention: false,
      status: "calling",
    });

    const firstStatus = await callTool<{ sessionId: string; status: string; debriefState: string }>(
      3,
      "get_voice_status",
      { session_id: first.sessionId },
    );
    expect(firstStatus).toMatchObject({
      sessionId: first.sessionId,
      status: "awaiting_confirmation",
      debriefState: "awaiting_confirmation",
    });

    const firstPartial = await callTool<{ status: string; debriefState: string }>(
      4,
      "confirm_debrief",
      { session_id: first.sessionId, outcome: "partial" },
    );
    expect(firstPartial).toMatchObject({ status: "partial", debriefState: "partial" });

    const correction = await callTool<{ memoryId: string; status: string; correction: string; skill: string }>(
      5,
      "teach_from_correction",
      { session_id: first.sessionId, correction: "Ask for the next meeting before discussing price." },
    );
    expect(correction).toMatchObject({
      status: "candidate",
      correction: "Ask for the next meeting before discussing price.",
      skill: "debrief",
    });

    const approved = await callTool<{ memoryId: string; status: string }>(
      6,
      "approve_memory",
      { session_id: first.sessionId, memory_id: correction.memoryId },
    );
    expect(approved).toMatchObject({ memoryId: correction.memoryId, status: "approved" });
    const published = await callTool<{ memoryId: string; status: string }>(
      7,
      "publish_memory",
      { session_id: first.sessionId, memory_id: correction.memoryId },
    );
    expect(published).toMatchObject({ memoryId: correction.memoryId, status: "published" });

    const proxy = await request({
      method: "POST",
      path: "/v1/chat/completions",
      headers: {
        authorization: `Bearer ${token}`,
        "x-kitstack-session-id": first.sessionId,
        "x-kitstack-parent-id": "voice-readback-1",
        "x-kitstack-trace-id": "trace-first",
      },
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Read back the next-step guidance." }],
      },
    });
    expect(proxy.status).toBe(200);
    expect(proxy.body).toMatchObject({
      choices: [{ message: { content: "Demo extraction complete." } }],
      usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
    });

    const firstTrace = await request({
      method: "GET",
      path: `/api/demo/sessions/${encodeURIComponent(first.sessionId)}`,
    });
    expect(firstTrace.status).toBe(200);
    const firstTraceBody = body<{ session: { state: string; memoryIds: string[] }; events: EventRow[] }>(firstTrace);
    expect(firstTraceBody.session).toMatchObject({ state: "partial" });
    expect(firstTraceBody.session.memoryIds).toContain(correction.memoryId);
    expect(firstTraceBody.events.some((event) => event.type === "inference" && event.parentId === "voice-readback-1" && event.traceId === "trace-first")).toBe(true);
    expect(JSON.stringify(firstTraceBody)).not.toMatch(/transcript|audio/i);

    const second = await callTool<{ sessionId: string; instructionVersion: string; memoryIds: string[] }>(
      8,
      "prepare_debrief",
      { goal: "Improve German sales qualification" },
    );
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.instructionVersion).toBe(first.instructionVersion);
    expect(second.memoryIds).toContain(correction.memoryId);

    const secondStart = await callTool<{ sessionId: string; status: string }>(
      9,
      "start_voice_call",
      { session_id: second.sessionId },
    );
    expect(secondStart.status).toBe("calling");
    const secondStatus = await callTool<{ sessionId: string; status: string; debriefState: string }>(
      10,
      "get_voice_status",
      { session_id: second.sessionId },
    );
    expect(secondStatus).toMatchObject({ status: "awaiting_confirmation" });

    const confirmed = await callTool<{ sessionId: string; status: string }>(
      11,
      "confirm_debrief",
      { session_id: second.sessionId, outcome: "confirmed" },
    );
    expect(confirmed).toMatchObject({ sessionId: second.sessionId, status: "confirmed" });

    const observability = await request({
      method: "GET",
      path: "/api/demo/observability",
      query: { limit: "200" },
    });
    expect(observability.status).toBe(200);
    const observabilityBody = body<{ events: EventRow[]; aggregate: Aggregate }>(observability);
    expect(observabilityBody.events.some((event) => event.sessionId === first.sessionId && event.memoryIds?.includes(correction.memoryId))).toBe(true);
    expect(observabilityBody.events.some((event) => event.sessionId === second.sessionId && event.instructionVersions?.includes(second.instructionVersion))).toBe(true);
    expect(observabilityBody.events.some((event) => event.appId === appId && event.type === "inference")).toBe(true);
    expect(observabilityBody.aggregate.totalResponseTokens).toBe(6);
    expect(observabilityBody.aggregate.totalEstimatedCostUsd).toBeGreaterThan(0);
    expect(observabilityBody.aggregate.byChannel.map((dimension) => dimension.key)).toEqual(expect.arrayContaining(["proxy", "voice", "system"]));
    expect(JSON.stringify(observabilityBody.events)).not.toMatch(/transcript|audio|completion complete/i);

    const reset = await request({
      method: "POST",
      path: "/api/demo/reset",
      headers: { "x-demo-reset-token": "demo-reset" },
    });
    expect(reset.status).toBe(200);
    expect(reset.body).toMatchObject({
      ok: true,
      cleared: ["sessions", "memory", "telemetry"],
      preserved: ["app_registry", "token_registry"],
    });
    expect(app.apps.get(appId)?.id).toBe(appId);
    await expect(app.apps.verify(token)).resolves.toMatchObject({ sub: appId });
    const activeApp = app;
    if (!activeApp) throw new Error("Demo app is not initialized");
    expect(() => activeApp.debrief.getSession(first.sessionId)).toThrow(`Debrief session "${first.sessionId}" was not found`);
    expect(await app.telemetry.query({ orgId: app.orgId })).toEqual([]);

    const repeat = await callTool<{ sessionId: string; memoryIds: string[] }>(
      12,
      "prepare_debrief",
      { goal: "Improve German sales qualification" },
    );
    expect(repeat.sessionId).not.toBe(first.sessionId);
    expect(repeat.memoryIds).toEqual([]);
    const repeatStart = await callTool<{ sessionId: string; status: string }>(
      13,
      "start_voice_call",
      { session_id: repeat.sessionId },
    );
    expect(repeatStart.status).toBe("calling");
    const repeatStatus = await callTool<{ sessionId: string; status: string; debriefState: string }>(
      14,
      "get_voice_status",
      { session_id: repeat.sessionId },
    );
    expect(repeatStatus).toMatchObject({ status: "awaiting_confirmation" });
    const repeatConfirmed = await callTool<{ status: string; debriefState: string }>(
      15,
      "confirm_debrief",
      { session_id: repeat.sessionId, outcome: "confirmed" },
    );
    expect(repeatConfirmed).toMatchObject({ status: "confirmed", debriefState: "confirmed" });
  });
});

interface EventRow {
  type?: string;
  appId?: string | null;
  sessionId?: string | null;
  parentId?: string | null;
  traceId?: string | null;
  instructionVersions?: string[];
  memoryIds?: string[];
}

interface Aggregate {
  totalResponseTokens: number;
  totalEstimatedCostUsd: number;
  byChannel: Array<{ key: string | null }>;
}

async function request(request: DemoAppRouteRequest): Promise<{ status: number; body: unknown }> {
  if (!app) throw new Error("Demo app is not initialized");
  const response = await handleDemoAppRequest(app, request);
  return { status: response.status, body: response.body };
}

async function callTool<T>(id: number, name: string, args: Record<string, unknown>): Promise<T> {
  const response = await request({
    method: "POST",
    path: "/mcp",
    body: { id, method: "tools/call", params: { name, arguments: args } },
  });
  expect(response.status).toBe(200);
  const result = response.body as { result?: { content?: Array<{ text?: string }> } };
  const text = result.result?.content?.[0]?.text;
  if (!text) throw new Error(`MCP tool ${name} returned no text content`);
  return JSON.parse(text) as T;
}

function body<T>(response: { body: unknown }): T {
  return response.body as T;
}

function field<T>(value: unknown, name: string): T {
  const fieldValue = (value as Record<string, unknown>)[name];
  if (fieldValue === undefined) throw new Error(`Response field ${name} is missing`);
  return fieldValue as T;
}
