import { afterEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { createAuditStore, type DebriefAuditStore } from "./index";

let client: Client | undefined;
let store: DebriefAuditStore | undefined;

afterEach(async () => {
  await store?.close();
  if (client) client.close();
  store = undefined;
  client = undefined;
});

function deniedEvent() {
  return {
    eventId: "denied-1",
    timestamp: "2026-09-16T10:05:00.000Z",
    orgId: "org-demo",
    principal: "user-1",
    actor: "agent-1",
    sessionId: "session-1",
    traceId: "trace-1",
    channel: "mcp",
    kitId: "kit:debrief",
    action: "tool.call",
    outcome: "denied" as const,
    errorCode: "missing_grant",
  };
}

describe("DebriefAuditStore", () => {
  it("persists denied actions and exports every denial without bodies", async () => {
    store = await createAuditStore({ url: ":memory:" });
    await store.append(deniedEvent());
    await store.append({ ...deniedEvent(), eventId: "denied-2", action: "connector.call" });

    expect(await store.verify()).toMatchObject({ valid: true, records: 2 });
    const records = await store.query({ outcome: "denied" });
    expect(records).toHaveLength(2);
    const exported = JSON.parse(await store.export("json")) as Array<Record<string, unknown>>;
    expect(exported.map((record) => record.errorCode)).toEqual(["missing_grant", "missing_grant"]);
    expect(JSON.stringify(exported)).not.toContain("prompt");
    expect(JSON.stringify(exported)).not.toContain("transcript");
  });

  it("detects a tampered database row", async () => {
    client = createClient({ url: ":memory:" });
    store = await createAuditStore({ client });
    await store.append(deniedEvent());
    await client.execute({ sql: "UPDATE audit_events SET action = ? WHERE sequence = 1", args: ["tampered"] });

    await expect(store.verify()).resolves.toMatchObject({
      valid: false,
      firstInvalidSequence: 1,
      reason: "hash",
    });
  });

  it("rejects body-shaped audit input before it reaches libSQL", async () => {
    store = await createAuditStore({ url: ":memory:" });
    await expect(store.append({ ...deniedEvent(), toolPayload: { secret: true } } as never)).rejects.toThrow(/metadata only/);
    expect(await store.query()).toHaveLength(0);
  });
});
