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

  it("lists the customer's earlier confirmed debriefs with the draft, newest first", async () => {
    const { client, service } = await persistentSetup();
    try {
      const customer = { company: "Acme Corp", contactName: "Mr John Doe", location: "Köln Café" };
      const confirmOne = async (goal: string, fields: Record<string, string>) => {
        const prepared = await service.prepareDebrief({ goal, ...customer });
        await service.markCalling(prepared.sessionId);
        await service.awaitConfirmation(prepared.sessionId);
        await service.updateDebriefDraft(prepared.sessionId, fields);
        await service.confirmDebriefDraft(prepared.sessionId);
        return prepared.sessionId;
      };
      const first = await confirmOne("Open the account", { outcome: "Interested", next_step: "Send deck" });
      const second = await confirmOne("Agree the pilot", { outcome: "Pilot agreed", follow_up_date: "2026-11-15" });

      const current = await service.prepareDebrief({ goal: "Review the pilot", ...customer });
      await service.markCalling(current.sessionId);
      await service.awaitConfirmation(current.sessionId);
      const result = await service.getDebriefForConfirmation(current.sessionId);

      expect(result.previous_debriefs?.map((entry) => entry.session_id).sort()).toEqual([first, second].sort());
      const byId = Object.fromEntries((result.previous_debriefs ?? []).map((entry) => [entry.session_id, entry.fields]));
      expect(byId[first]).toEqual({ outcome: "Interested", next_step: "Send deck" });
      expect(byId[second]).toEqual({ outcome: "Pilot agreed", follow_up_date: "2026-11-15" });
      const times = (result.previous_debriefs ?? []).map((entry) => entry.confirmed_at);
      expect([...times].sort().reverse()).toEqual(times);
      // The session being confirmed is never listed as its own history.
      const own = await service.confirmDebriefDraft(current.sessionId);
      expect(own.previous_debriefs?.map((entry) => entry.session_id)).not.toContain(current.sessionId);
    } finally {
      client.close();
    }
  });

  it("hydrates a session created by another task before a scheduler operation", async () => {
    const first = await persistentSetup();
    try {
      const prepared = await first.service.prepareDebrief({
        goal: "Call the customer",
        company: "Acme Corp",
        contactName: "Mr John Doe",
        location: "Köln Café",
      });
      const second = new DebriefService(
        { readRelevant: vi.fn(async () => []), writeCandidate: vi.fn(), approveCandidate: vi.fn(), publishCandidate: vi.fn() } as any,
        { resolve: vi.fn() } as any,
        { append: vi.fn(async () => undefined) } as any,
        { orgId: "o", appId: "a" },
        undefined,
        { persistence: createDebriefPersistence(first.client) },
      );
      await expect(second.hydrateSession(prepared.sessionId)).resolves.toMatchObject({
        sessionId: prepared.sessionId,
        state: "prepared",
        customerId: prepared.customerId,
      });
    } finally {
      first.client.close();
    }
  });

  it("schedules a prebrief call before the callback and rejects one on or after it", async () => {
    const { client, service } = await persistentSetup();
    try {
      const callbackAt = new Date(Date.now() + 2 * 3600_000).toISOString();
      const prebriefCallAt = new Date(Date.now() + 3600_000).toISOString();
      const prepared = await service.prepareDebrief({
        goal: "Close the renewal", company: "Acme Corp", contactName: "John Doe", location: "Köln Café",
        callbackAt, callbackTimezone: "Europe/Berlin", prebriefCallAt,
      });
      expect("prebrief_call_at" in prepared && prepared.prebrief_call_at).toBe(prebriefCallAt);

      const afterCallback = new Date(Date.now() + 2.5 * 3600_000).toISOString();
      await expect(service.prepareDebrief({
        goal: "Close the renewal", company: "Acme Corp", contactName: "John Doe", location: "Köln Café",
        callbackAt, callbackTimezone: "Europe/Berlin", prebriefCallAt: afterCallback,
      })).rejects.toThrow("prebrief_call_at must be before callback_at");

      await expect(service.prepareDebrief({
        goal: "Close the renewal", company: "Acme Corp", contactName: "John Doe", location: "Köln Café",
        prebriefCallAt,
      })).rejects.toThrow("prebrief_call_at requires callback_at and callback_timezone");
    } finally {
      client.close();
    }
  });

  it("saves a prebrief call's meeting plan without touching session state, then surfaces it for the debrief call", async () => {
    const { client, service } = await persistentSetup();
    try {
      const prepared = await service.prepareDebrief({ goal: "Close the renewal", company: "Acme Corp", contactName: "John Doe", location: "Köln Café" });
      expect(await service.getMeetingPlan(prepared.sessionId)).toBeNull();

      const saved = await service.saveMeetingPlan(prepared.sessionId, "  Push for a 2-year contract and address the support SLA concern.  ");
      expect(saved.plan).toBe("Push for a 2-year contract and address the support SLA concern.");
      expect(await service.getMeetingPlan(prepared.sessionId)).toBe("Push for a 2-year contract and address the support SLA concern.");

      // Saving the plan is draft-independent: the session is untouched, and
      // it never becomes a customer event (the plan lives in its own table).
      expect(service.getSession(prepared.sessionId).state).toBe("prepared");
      await expect(service.getDraft(prepared.sessionId)).resolves.toBeNull();
      const events = (await service.listCustomerEvents(prepared.customerId!)).filter((event) => event.sessionId === prepared.sessionId);
      expect(events.some((event) => (event.type as string) === "meeting_plan")).toBe(false);

      const plans = await service.listMeetingPlansForCustomer(prepared.customerId!);
      expect(plans).toEqual([expect.objectContaining({
        sessionId: prepared.sessionId,
        plan: "Push for a 2-year contract and address the support SLA concern.",
      })]);

      await expect(service.saveMeetingPlan(prepared.sessionId, "   ")).rejects.toThrow("Meeting plan must not be empty");
    } finally {
      client.close();
    }
  });

  it("refuses to schedule a callback for an owner with no verified number and no operator fallback", async () => {
    const { service } = setup();
    await expect(service.prepareDebrief({
      goal: "Call the customer",
      company: "Acme Corp",
      contactName: "John Doe",
      location: "Köln Café",
      callbackAt: new Date(Date.now() + 3_600_000).toISOString(),
      callbackTimezone: "Europe/Berlin",
      ownerId: "user-1",
    })).rejects.toThrow("No verified phone number is on file");
  });

  it("schedules a callback once the owner has a verified number", async () => {
    const memories: any[] = [];
    const memory: any = { writeCandidate: vi.fn(), approveCandidate: vi.fn(), publishCandidate: vi.fn(), readRelevant: vi.fn(async () => memories) };
    const phoneDirectory = { hasVerifiedNumber: vi.fn(async (orgId: string, userId: string) => orgId === "o" && userId === "user-1") };
    const service = new DebriefService(memory, { resolve: vi.fn(async () => instruction) } as any, { append: vi.fn(async () => undefined) } as any, { orgId: "o", appId: "a" }, undefined, { phoneDirectory });
    const prepared = await service.prepareDebrief({
      goal: "Call the customer",
      company: "Acme Corp",
      contactName: "John Doe",
      location: "Köln Café",
      callbackAt: new Date(Date.now() + 3_600_000).toISOString(),
      callbackTimezone: "Europe/Berlin",
      ownerId: "user-1",
    });
    expect(phoneDirectory.hasVerifiedNumber).toHaveBeenCalledWith("o", "user-1");
    expect(service.getSession(prepared.sessionId).ownerId).toBe("user-1");
  });

  it("falls back to the operator destination for the operator org even without a verified number", async () => {
    const memory: any = { writeCandidate: vi.fn(), approveCandidate: vi.fn(), publishCandidate: vi.fn(), readRelevant: vi.fn(async () => []) };
    const phoneDirectory = { hasVerifiedNumber: vi.fn(async () => false) };
    const service = new DebriefService(memory, { resolve: vi.fn(async () => instruction) } as any, { append: vi.fn(async () => undefined) } as any, { orgId: "org-demo", appId: "a" }, undefined, {
      phoneDirectory,
      operatorFallback: { orgId: "org-demo", destination: "+491234567890" },
    });
    const prepared = await service.prepareDebrief({
      goal: "Call the customer",
      company: "Acme Corp",
      contactName: "John Doe",
      location: "Köln Café",
      callbackAt: new Date(Date.now() + 3_600_000).toISOString(),
      callbackTimezone: "Europe/Berlin",
      ownerId: "default-user",
    });
    expect(service.getSession(prepared.sessionId)).toMatchObject({ state: "prepared", ownerId: "default-user" });
  });

  it("never requires a phone number for a goal-only rehearsal, even with an ownerId", async () => {
    const { service } = setup();
    await expect(service.prepareDebrief({ goal: "Rehearse", ownerId: "user-1" })).resolves.toMatchObject({ state: "prepared" });
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
