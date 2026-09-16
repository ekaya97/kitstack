import { describe, expect, it, vi } from "vitest";
import {
  createHttpAuditExporter,
  HashChainedAuditStore,
  type AuditPersistence,
  type AuditRecord,
} from "../src/audit";

class TestPersistence implements AuditPersistence {
  readonly records: AuditRecord[] = [];

  append(record: AuditRecord): void {
    this.records.push(record);
  }

  list(): AuditRecord[] {
    return [...this.records];
  }
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "audit-1",
    timestamp: "2026-09-16T10:00:00.000Z",
    orgId: "org-demo",
    principal: "user-1",
    actor: "agent-1",
    sessionId: "session-1",
    traceId: "trace-1",
    channel: "mcp",
    kitId: "kit:debrief",
    action: "tool.call",
    outcome: "success" as const,
    ...overrides,
  };
}

describe("HashChainedAuditStore", () => {
  it("chains records and exports a content-free SIEM shape", async () => {
    const persistence = new TestPersistence();
    const store = new HashChainedAuditStore({ persistence });
    await store.append(input());
    const denied = await store.append(input({
      eventId: "audit-2",
      action: "tool.call",
      outcome: "denied",
      errorCode: "missing_grant",
      attributes: { relation: "kit:act", policy: "demo" },
    }));

    expect(denied.previousHash).toBe(persistence.records[0].hash);
    expect((await store.verify()).valid).toBe(true);

    const exported = JSON.parse(await store.export("json")) as Array<Record<string, unknown>>;
    expect(exported).toHaveLength(2);
    expect(exported[1]).toMatchObject({ outcome: "denied", errorCode: "missing_grant" });
    expect(exported[1]).not.toHaveProperty("arguments");
    expect(exported[1]).not.toHaveProperty("result");
    expect(await store.export("csv")).toContain("eventId,timestamp,sequence");
    expect(await new HashChainedAuditStore().export("csv")).toContain("eventId,timestamp,sequence");
  });

  it("detects tampering in a persisted row", async () => {
    const persistence = new TestPersistence();
    const store = new HashChainedAuditStore({ persistence });
    await store.append(input());
    await store.append(input({ eventId: "audit-2", action: "memory.read" }));

    persistence.records[0] = { ...persistence.records[0], action: "admin.delete" };
    await expect(store.verify()).resolves.toMatchObject({
      valid: false,
      firstInvalidSequence: 1,
      reason: "hash",
    });
  });

  it("rejects replayed event ids and sensitive content at both boundaries", async () => {
    const store = new HashChainedAuditStore();
    await store.append(input());
    await expect(store.append(input())).rejects.toThrow("already exists");
    await expect(store.append(input({ prompt: "never persist this" }))).rejects.toThrow(/metadata only/);
    await expect(store.append(input({ attributes: { transcript: "never persist this" } }))).rejects.toThrow(/metadata only/);
    await expect(store.append(input({ attributes: { nested: { secret: true } } }))).rejects.toThrow(/scalar metadata/);
  });

  it("delivers the same content-free export to an HTTP SIEM endpoint", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 202 }));
    const exporter = createHttpAuditExporter({
      endpoint: "https://siem.example.test/audit",
      headers: { authorization: "Bearer test" },
      fetch: fetcher,
    });
    const store = new HashChainedAuditStore({ exporter });
    await store.append(input({ outcome: "denied", errorCode: "missing_grant" }));

    const exported = await store.export("json");
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://siem.example.test/audit"),
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test",
        },
        body: exported,
      }),
    );
    expect(exported).not.toContain("prompt");
  });

  it("rejects non-HTTP endpoints before any export", () => {
    expect(() => createHttpAuditExporter({ endpoint: "file:///tmp/audit" })).toThrow(/http or https/);
  });
});
