import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createTelemetryStore,
  type TelemetryEventInput,
  type TelemetryStore,
} from "./index.js";

let store: TelemetryStore;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await store?.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function makeStore(): Promise<TelemetryStore> {
  store = await createTelemetryStore({ url: ":memory:" });
  return store;
}

function event(overrides: Partial<TelemetryEventInput> = {}): TelemetryEventInput {
  return {
    id: "evt-1",
    timestamp: "2026-09-14T20:00:00.000Z",
    orgId: "org-demo",
    appId: "app-sales",
    principal: "user-1",
    actor: "agent-1",
    delegation: "delegation-1",
    sessionId: "session-1",
    channel: "chat",
    type: "mcp.tool_call",
    operation: "prepare_debrief",
    outcome: "success",
    ...overrides,
  };
}

describe("TelemetryStore", () => {
  it("appends and queries metadata without retaining bodies", async () => {
    const telemetry = await makeStore();
    await expect(telemetry.append({
      ...event({
        requestTokens: 120,
        responseTokens: 40,
        latencyMs: 95,
        estimatedCostUsd: 0.0025,
        provider: "twilio-openai-realtime",
        callId: "CA123",
        instructionVersions: ["interviewer@1"],
        memoryIds: ["memory-1"],
      }),
      // Runtime callers must not cross the SDK retention boundary with bodies.
      prompt: "do not retain me",
      completion: "do not retain me",
      audio: "do not retain me",
      transcript: "do not retain me",
      toolPayload: { secret: true },
    } as TelemetryEventInput & Record<string, unknown>)).rejects.toThrow(/metadata only/);

    const appended = await telemetry.append(event({
      requestTokens: 120,
      responseTokens: 40,
      latencyMs: 95,
      estimatedCostUsd: 0.0025,
      provider: "twilio-openai-realtime",
      callId: "CA123",
      instructionVersions: ["interviewer@1"],
      memoryIds: ["memory-1"],
    }));
    expect(appended.sequence).toBe(1);
    expect(appended.requestTokens).toBe(120);
    expect(appended.instructionVersions).toEqual(["interviewer@1"]);
    expect(appended.memoryIds).toEqual(["memory-1"]);
    expect(appended).toMatchObject({ principal: "user-1", actor: "agent-1", delegation: "delegation-1" });

    const rows = await telemetry.query({ sessionId: "session-1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "evt-1",
      orgId: "org-demo",
      appId: "app-sales",
      latencyMs: 95,
      estimatedCostUsd: 0.0025,
      provider: "twilio-openai-realtime",
      callId: "CA123",
      principal: "user-1",
      actor: "agent-1",
      delegation: "delegation-1",
    });
  });

  it("forwards persisted metadata to the host exporter without losing local reads", async () => {
    const exported: unknown[] = [];
    store = await createTelemetryStore({
      url: ":memory:",
      exporter: { export: async (value) => { exported.push(value); } },
    });

    const appended = await store.append(event({ id: "exported-1", latencyMs: 42 }));

    expect(exported).toHaveLength(1);
    expect(exported[0]).toMatchObject({ id: "exported-1", latencyMs: 42, orgId: "org-demo" });
    expect(await store.query({ sessionId: "session-1" })).toHaveLength(1);
    expect(JSON.stringify(exported[0])).not.toMatch(/prompt|completion|audio|transcript|toolPayload/i);
    expect(appended.id).toBe("exported-1");
  });

  it("keeps local telemetry available when the host collector is unavailable", async () => {
    const exportErrors: Error[] = [];
    store = await createTelemetryStore({
      url: ":memory:",
      exporter: { export: async () => { throw new Error("collector unavailable"); } },
      onExportError: (error) => { exportErrors.push(error); },
    });

    await store.append(event({ id: "collector-down" }));

    expect(exportErrors.map((error) => error.message)).toEqual(["collector unavailable"]);
    expect(await store.query({ sessionId: "session-1" })).toHaveLength(1);
  });

  it("supports nullable appId for boot events", async () => {
    const telemetry = await makeStore();
    await telemetry.append(event({
      id: "boot-1",
      appId: null,
      type: "plugin.registered",
      operation: "register",
      channel: "system",
    }));
    await telemetry.append(event({ id: "app-1" }));

    expect(await telemetry.query({ appId: null })).toHaveLength(1);
    expect((await telemetry.query({ appId: null }))[0].appId).toBeNull();
    expect(await telemetry.query({ appId: "app-sales" })).toHaveLength(1);
    expect((await telemetry.aggregate({ appId: null })).totalEvents).toBe(1);
  });

  it("scopes metadata queries by customer without retaining customer payloads", async () => {
    const telemetry = await makeStore();
    await telemetry.append(event({ id: "customer-a", customerId: "customer-1" }));
    await telemetry.append(event({ id: "customer-b", customerId: "customer-2" }));

    expect((await telemetry.query({ customerId: "customer-1" })).map((item) => item.id)).toEqual(["customer-a"]);
    expect((await telemetry.query({ orgId: "org-demo", customerId: "customer-2" }))[0]).toMatchObject({ customerId: "customer-2" });
  });

  it("keeps parent-child traces in append order rather than timestamp order", async () => {
    const telemetry = await makeStore();
    await telemetry.append(event({
      id: "parent",
      timestamp: "2026-09-14T20:00:02.000Z",
      type: "voice.call",
      operation: "start",
      channel: "voice",
    }));
    await telemetry.append(event({
      id: "child",
      timestamp: "2026-09-14T20:00:01.000Z",
      parentId: "parent",
      type: "inference",
      operation: "read_back",
      channel: "proxy",
    }));

    const rows = await telemetry.query({ sessionId: "session-1" });
    expect(rows.map((row) => row.id)).toEqual(["parent", "child"]);
    expect(rows[1].parentId).toBe("parent");
    expect(rows[1].sequence).toBeGreaterThan(rows[0].sequence);
  });

  it("aggregates totals and app/type/channel dimensions", async () => {
    const telemetry = await makeStore();
    await telemetry.append(event({
      id: "a",
      requestTokens: 100,
      responseTokens: 50,
      estimatedCostUsd: 0.01,
      latencyMs: 10,
    }));
    await telemetry.append(event({
      id: "b",
      appId: null,
      channel: "voice",
      type: "voice.call",
      operation: "completed",
      outcome: "error",
      requestTokens: 20,
      responseTokens: 5,
      estimatedCostUsd: 0.02,
      latencyMs: 30,
    }));

    const aggregate = await telemetry.aggregate({ orgId: "org-demo" });
    expect(aggregate).toMatchObject({
      totalEvents: 2,
      totalRequestTokens: 120,
      totalResponseTokens: 55,
      totalEstimatedCostUsd: 0.03,
      totalLatencyMs: 40,
      successCount: 1,
      errorCount: 1,
    });
    expect(aggregate.byApp).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: null, eventCount: 1, estimatedCostUsd: 0.02 }),
      expect.objectContaining({ key: "app-sales", eventCount: 1, estimatedCostUsd: 0.01 }),
    ]));
    expect(aggregate.byType).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "mcp.tool_call", eventCount: 1 }),
      expect.objectContaining({ key: "voice.call", eventCount: 1 }),
    ]));
    expect(aggregate.byChannel).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "chat", eventCount: 1 }),
      expect.objectContaining({ key: "voice", eventCount: 1 }),
    ]));
  });

  it("resets telemetry and starts insertion ordering over", async () => {
    const telemetry = await makeStore();
    await telemetry.append(event());
    await telemetry.reset();
    expect(await telemetry.query()).toEqual([]);

    const next = await telemetry.append(event({ id: "evt-after-reset" }));
    expect(next.sequence).toBe(2);
    expect((await telemetry.aggregate()).totalEvents).toBe(1);
  });

  it("persists metadata across store instances", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kitstack-demo-telemetry-"));
    temporaryDirectories.push(directory);
    const dbPath = join(directory, "telemetry.db");
    const first = await createTelemetryStore({ dbPath });
    await first.append(event({ id: "persisted" }));
    await first.close();

    store = await createTelemetryStore({ dbPath });
    expect((await store.query())[0]).toMatchObject({ id: "persisted" });
  });

  it("rejects the existing local kit database path", async () => {
    await expect(createTelemetryStore({ dbPath: "databases/local.db" })).rejects.toThrow(
      "must not reuse databases/local.db",
    );
  });
});
