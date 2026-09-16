import { afterEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { createTelemetryStore, type TelemetryStore } from "../plugins/telemetry/index.js";
import { createMemoryStore, type MemoryContext, type MemoryStore } from "./plugin.js";

let client: Client;
let telemetry: TelemetryStore;
let memory: MemoryStore;

afterEach(async () => {
  await telemetry?.close();
  client?.close();
});

async function setup(): Promise<void> {
  client = createClient({ url: ":memory:" });
  telemetry = await createTelemetryStore({ url: ":memory:" });
  memory = createMemoryStore(client, telemetry, {
    now: (() => {
      let index = 0;
      return () => `2026-09-14T20:00:0${index++}.000Z`;
    })(),
    createMemoryId: (() => {
      let index = 0;
      return () => `memory-${++index}`;
    })(),
    createVersionId: (() => {
      let index = 0;
      return () => `version-${++index}`;
    })(),
    createEventId: (() => {
      let index = 0;
      return () => `memory-event-${++index}`;
    })(),
  });
}

function context(overrides: Partial<MemoryContext> = {}): MemoryContext {
  return {
    orgId: "org-demo",
    appId: "app-sales",
    sessionId: "run-1",
    traceId: "trace-1",
    parentId: "parent-1",
    kitId: "debrief",
    ...overrides,
  };
}

describe("MemoryStore", () => {
  it("keeps a candidate out of replay until approve and publish", async () => {
    await setup();
    const candidate = await memory.writeCandidate({
      correction: "Ask about implementation timeline before pricing.",
      skill: "discovery-sequencing",
      context: { stage: "discovery", objection: "timing" },
    }, context());

    expect(candidate).toMatchObject({
      memoryId: "memory-1",
      versionId: "version-1",
      status: "candidate",
    });
    expect(await memory.readRelevant({ orgId: "org-demo", kitId: "debrief" }, context({ sessionId: "run-2" }))).toEqual([]);

    const approved = await memory.approveCandidate(candidate.memoryId, context());
    expect(approved).toMatchObject({ status: "approved", approvedAt: expect.any(String) });
    expect(await memory.readRelevant({ orgId: "org-demo", kitId: "debrief" }, context({ sessionId: "run-2" }))).toHaveLength(1);

    const published = await memory.publishCandidate(candidate.memoryId, context());
    expect(published).toMatchObject({ status: "published", publishedAt: expect.any(String) });
  });

  it("replays approved run-1 feedback in run 2 with deterministic ordering", async () => {
    await setup();
    const first = await memory.writeCandidate({
      correction: "Lead with the measurable outcome.",
      skill: "value-framing",
      context: { stage: "opening" },
    }, context({ sessionId: "run-1" }));
    await memory.approveCandidate(first.memoryId, context({ sessionId: "run-1" }));
    const second = await memory.writeCandidate({
      correction: "Confirm the buying committee before proposing next steps.",
      skill: "qualification",
      context: { stage: "discovery" },
    }, context({ sessionId: "run-1" }));
    await memory.approveCandidate(second.memoryId, context({ sessionId: "run-1" }));
    await memory.publishCandidate(second.memoryId, context({ sessionId: "run-1" }));

    const replay = await memory.readRelevant({
      orgId: "org-demo",
      kitId: "debrief",
      context: { stage: "opening" },
    }, context({ sessionId: "run-2", traceId: "trace-2" }));

    expect(replay.map((item) => item.memoryId)).toEqual(["memory-1"]);
    expect(replay[0]).toMatchObject({
      correction: "Lead with the measurable outcome.",
      skill: "value-framing",
      status: "approved",
      context: { stage: "opening" },
    });
  });

  it("creates distinct version IDs and returns newest records first", async () => {
    await setup();
    const one = await memory.writeCandidate({ correction: "One", skill: "skill", context: {} }, context());
    await memory.approveCandidate(one.memoryId, context());
    const two = await memory.writeCandidate({ correction: "Two", skill: "skill", context: {} }, context());
    await memory.approveCandidate(two.memoryId, context());

    expect(one.versionId).not.toBe(two.versionId);
    expect((await memory.readRelevant({ orgId: "org-demo", kitId: "debrief" }, context())).map((item) => item.versionId))
      .toEqual([two.versionId, one.versionId]);
  });

  it("isolates organizations and kits", async () => {
    await setup();
    const owned = await memory.writeCandidate({ correction: "Owned", skill: "skill", context: {} }, context());
    await memory.approveCandidate(owned.memoryId, context());
    const otherOrg = await memory.writeCandidate({ correction: "Other", skill: "skill", context: {} }, context({ orgId: "org-other" }));
    await memory.approveCandidate(otherOrg.memoryId, context({ orgId: "org-other" }));

    expect(await memory.readRelevant({ orgId: "org-demo", kitId: "debrief" }, context({ sessionId: "run-2" }))).toHaveLength(1);
    expect(await memory.readRelevant({ orgId: "org-other", kitId: "debrief" }, context({ orgId: "org-other" }))).toHaveLength(1);
    await expect(memory.readRelevant({ orgId: "org-other", kitId: "debrief" }, context())).rejects.toThrow("must match");
    await expect(memory.approveCandidate(otherOrg.memoryId, context())).rejects.toThrow("not found");
  });

  it("resets memory without deleting telemetry", async () => {
    await setup();
    const candidate = await memory.writeCandidate({ correction: "Reset me", skill: "skill", context: {} }, context());
    await memory.approveCandidate(candidate.memoryId, context());
    await memory.reset(context());

    expect(await memory.readRelevant({ orgId: "org-demo", kitId: "debrief" }, context())).toEqual([]);
    const writes = await telemetry.query({ type: "memory.write" });
    expect(writes).toHaveLength(3);
    expect(writes[2]).toMatchObject({ operation: "reset", memoryIds: [candidate.memoryId] });
  });

  it("retains only structured memory fields, never prompt, completion, transcript, audio, or raw payload", async () => {
    await setup();
    const input: {
      correction: string;
      skill: string;
      context: Record<string, string>;
      prompt: string;
      completion: string;
      transcript: string;
      audio: string;
      rawToolPayload: { secret: boolean };
    } = {
      correction: "Use a concrete customer outcome.",
      skill: "value-framing",
      context: { stage: "opening" },
      prompt: "secret prompt",
      completion: "secret completion",
      transcript: "secret transcript",
      audio: "secret audio",
      rawToolPayload: { secret: true },
    };
    const record = await memory.writeCandidate(input, context());

    expect(record).not.toHaveProperty("prompt");
    expect(record).not.toHaveProperty("completion");
    expect(record).not.toHaveProperty("transcript");
    expect(record).not.toHaveProperty("audio");
    expect(record).not.toHaveProperty("rawToolPayload");
    expect(JSON.stringify(record)).not.toContain("secret");
  });

  it("emits metadata-only read/write telemetry with supplied trace identity and IDs", async () => {
    await setup();
    const runOne = context();
    const candidate = await memory.writeCandidate({ correction: "Remember this", skill: "skill", context: {} }, runOne);
    await memory.approveCandidate(candidate.memoryId, runOne);
    await memory.readRelevant({ orgId: "org-demo", kitId: "debrief" }, context({ sessionId: "run-2", traceId: "trace-2", parentId: "parent-2" }));

    const events = await telemetry.query({ orgId: "org-demo" });
    expect(events.map((event) => event.type)).toEqual(["memory.write", "memory.write", "memory.read"]);
    expect(events[0]).toMatchObject({
      appId: "app-sales",
      sessionId: "run-1",
      traceId: "trace-1",
      parentId: "parent-1",
      pluginId: "memory:default",
      kitId: "debrief",
      memoryIds: [candidate.memoryId],
    });
    expect(events[2]).toMatchObject({
      sessionId: "run-2",
      traceId: "trace-2",
      parentId: "parent-2",
      memoryIds: [candidate.memoryId],
    });
    for (const event of events) {
      expect(event).not.toHaveProperty("prompt");
      expect(event).not.toHaveProperty("completion");
      expect(event).not.toHaveProperty("transcript");
      expect(event).not.toHaveProperty("audio");
    }
  });
});
