import { describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { DebriefService } from "./index.js";
import { createDebriefPersistence } from "./persistence.js";

const instruction = { id: "i", kitId: "kit:debrief", context: "prebrief", locale: null, content: "x", version: "v1", hash: "h", source: "test" };
function setup() {
  const memories: any[] = [];
  const memory: any = { writeCandidate: vi.fn(async (input: any) => { const m = { memoryId: `m${memories.length + 1}`, versionId: "v", orgId: "o", kitId: "kit:debrief", sessionId: "s", ...input, status: "candidate" }; memories.push(m); return m; }), approveCandidate: vi.fn(async (id: string) => { const m = memories.find((item) => item.memoryId === id); m.status = "approved"; return m; }), publishCandidate: vi.fn(async (id: string) => { const m = memories.find((item) => item.memoryId === id); m.status = "published"; return m; }), readRelevant: vi.fn(async () => memories.filter((m) => m.status !== "candidate")) };
  const telemetry: any = { append: vi.fn(async () => undefined) };
  const instructions: any = { resolve: vi.fn(async () => instruction) };
  return { service: new DebriefService(memory, instructions, telemetry, { orgId: "o", appId: "a", id: (() => { let n = 0; return () => `s${++n}`; })() }), memory, telemetry };
}

async function persistentSetup() {
  const client = createClient({ url: ":memory:" });
  const memories: any[] = [];
  const memory: any = {
    writeCandidate: vi.fn(async (input: any) => ({ memoryId: `m${memories.length + 1}`, status: "candidate", ...input })),
    approveCandidate: vi.fn(async (id: string) => ({ memoryId: id, status: "approved" })),
    publishCandidate: vi.fn(async (id: string) => ({ memoryId: id, status: "published" })),
    readRelevant: vi.fn(async () => []),
  };
  const service = new DebriefService(
    memory,
    { resolve: vi.fn(async () => instruction) } as any,
    { append: vi.fn(async () => undefined) } as any,
    { orgId: "o", appId: "a" },
    undefined,
    { persistence: createDebriefPersistence(client) },
  );
  return { client, service };
}

describe("DebriefService", () => {
  it("runs prebrief, call, confirmation, and teaches a candidate", async () => {
    const { service, memory } = setup();
    const s = await service.prepareDebrief("sell");
    await service.markCalling(s.sessionId); await service.awaitConfirmation(s.sessionId);
    const candidate = await service.teachFromCorrection(s.sessionId, "Lead prefers email");
    expect(candidate.status).toBe("candidate");
    await service.approveMemory({ sessionId: s.sessionId, memoryId: candidate.memoryId });
    await service.publishMemory({ sessionId: s.sessionId, memoryId: candidate.memoryId });
    await service.confirmDebrief(s.sessionId);
    expect(service.getDebrief(s.sessionId).state).toBe("confirmed");
    expect(memory.writeCandidate).toHaveBeenCalledWith(expect.objectContaining({ correction: "Lead prefers email" }), expect.anything());
  });

  it("retrieves the approved run-1 memory on run 2 and stores metadata only", async () => {
    const { service, memory, telemetry } = setup();
    const first = await service.prepareDebrief("sell");
    await service.markCalling(first.sessionId); await service.awaitConfirmation(first.sessionId);
    const candidate = await service.teachFromCorrection(first.sessionId, "Use annual pricing");
    await service.approve(first.sessionId, candidate.memoryId);
    const second = await service.prepareDebrief("sell");
    expect(memory.readRelevant).toHaveBeenCalledTimes(2);
    expect(service.getDebrief(second.sessionId).memoryIds).toContain(candidate.memoryId);
    expect(service.getDebrief(second.sessionId)).not.toHaveProperty("correction");
    expect(telemetry.append).toHaveBeenCalled();
  });

  it("only transitions memories taught or retrieved by the target session", async () => {
    const { service, memory } = setup();
    const session = await service.prepareDebrief("sell");

    await expect(service.approveMemory({ sessionId: session.sessionId, memoryId: "memory-from-another-session" })).rejects.toThrow(
      `Memory "memory-from-another-session" is not part of debrief session "${session.sessionId}"`,
    );
    expect(memory.approveCandidate).not.toHaveBeenCalled();
  });

  it("passes the session's org and kit identity and emits no memory payload", async () => {
    const { service, memory, telemetry } = setup();
    const session = await service.prepareDebrief("sell");
    await service.markCalling(session.sessionId);
    await service.awaitConfirmation(session.sessionId);
    const candidate = await service.teachFromCorrection(session.sessionId, "Use annual pricing");

    await service.approveMemory({ sessionId: session.sessionId, memoryId: candidate.memoryId });
    await service.publishMemory({ sessionId: session.sessionId, memoryId: candidate.memoryId });

    expect(memory.approveCandidate).toHaveBeenCalledWith(candidate.memoryId, expect.objectContaining({
      orgId: "o",
      kitId: "kit:debrief",
      sessionId: session.sessionId,
      appId: "a",
    }));
    expect(memory.publishCandidate).toHaveBeenCalledWith(candidate.memoryId, expect.objectContaining({
      orgId: "o",
      kitId: "kit:debrief",
      sessionId: session.sessionId,
      appId: "a",
    }));
    for (const [event] of telemetry.append.mock.calls) {
      expect(event).not.toHaveProperty("correction");
    }
  });

  it("records a provider/start failure", async () => {
    const { service, telemetry } = setup();
    const session = await service.prepareDebrief("sell");
    const failed = await service.markFailed(session.sessionId, new Error("provider unavailable"));
    expect(failed.state).toBe("failed");
    expect(failed.error).toBe("provider unavailable");
    expect(telemetry.append).toHaveBeenCalledWith(expect.objectContaining({ type: "voice.call", outcome: "error" }));
  });

  it("supports editable confirmation and idempotent immutable customer events", async () => {
    const { client, service } = await persistentSetup();
    try {
      const prepared = await service.prepareDebrief({
        goal: "Close the next step",
        company: "Acme Corp",
        contactName: "Mr John Doe",
        location: "Köln Café",
      });
      await service.markCalling(prepared.sessionId);
      await service.awaitConfirmation(prepared.sessionId);

      const initial = await service.getDebriefForConfirmation(prepared.sessionId);
      expect(initial.draft.status).toBe("draft");
      const updated = await service.updateDebriefDraft(prepared.sessionId, {
        outcome: "Positive",
        next_step: "Send proposal",
        discovered_address: "Neue Straße 1, Köln",
      });
      expect(updated.draft.fields).toMatchObject({ next_step: "Send proposal" });

      const confirmed = await service.confirmDebriefDraft(prepared.sessionId);
      const replay = await service.confirmDebriefDraft(prepared.sessionId);
      expect(confirmed.state).toBe("confirmed");
      expect(confirmed.confirmed_event_id).toBe(replay.confirmed_event_id);
      expect(confirmed.address_event_id).toBe(replay.address_event_id);
      expect((await service.listCustomerEvents(prepared.customerId!)).filter((event) => event.sessionId === prepared.sessionId)).toEqual([
        expect.objectContaining({ type: "prebrief" }),
        expect.objectContaining({ type: "address_discovered", eventId: confirmed.address_event_id }),
        expect.objectContaining({ type: "debrief_confirmed", eventId: confirmed.confirmed_event_id }),
      ]);
    } finally {
      client.close();
    }
  });

  it("keeps partial completion free of confirmed events", async () => {
    const { client, service } = await persistentSetup();
    try {
      const prepared = await service.prepareDebrief({ goal: "Follow up", company: "Acme Corp", contactName: "John Doe", location: "Köln Café" });
      await service.markCalling(prepared.sessionId);
      await service.awaitConfirmation(prepared.sessionId);
      await service.markPartial(prepared.sessionId);
      expect((await service.listCustomerEvents(prepared.customerId!)).some((event) => event.type === "debrief_confirmed")).toBe(false);
    } finally {
      client.close();
    }
  });
});
