import { describe, expect, it, vi } from "vitest";
import { DebriefService } from "./index.js";

const instruction = { id: "i", kitId: "kit:debrief", context: "prebrief", locale: null, content: "x", version: "v1", hash: "h", source: "test" };
function setup() {
  const memories: any[] = [];
  const memory: any = { writeCandidate: vi.fn(async (input: any) => { const m = { memoryId: `m${memories.length + 1}`, versionId: "v", orgId: "o", kitId: "kit:debrief", sessionId: "s", ...input, status: "candidate" }; memories.push(m); return m; }), approveCandidate: vi.fn(async (id: string) => { const m = memories.find((item) => item.memoryId === id); m.status = "approved"; return m; }), publishCandidate: vi.fn(async (id: string) => { const m = memories.find((item) => item.memoryId === id); m.status = "published"; return m; }), readRelevant: vi.fn(async () => memories.filter((m) => m.status !== "candidate")) };
  const telemetry: any = { append: vi.fn(async () => undefined) };
  const instructions: any = { resolve: vi.fn(async () => instruction) };
  return { service: new DebriefService(memory, instructions, telemetry, { orgId: "o", appId: "a", id: (() => { let n = 0; return () => `s${++n}`; })() }), memory, telemetry };
}

describe("DebriefService", () => {
  it("runs prebrief, call, confirmation, and teaches a candidate", async () => {
    const { service, memory } = setup();
    const s = await service.prepareDebrief("sell");
    await service.markCalling(s.sessionId); await service.awaitConfirmation(s.sessionId);
    const candidate = await service.teachFromCorrection(s.sessionId, "Lead prefers email");
    expect(candidate.status).toBe("candidate");
    await service.approve(s.sessionId, candidate.memoryId); await service.publish(s.sessionId, candidate.memoryId);
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

  it("records a provider/start failure", async () => {
    const { service, telemetry } = setup();
    const session = await service.prepareDebrief("sell");
    const failed = await service.markFailed(session.sessionId, new Error("provider unavailable"));
    expect(failed.state).toBe("failed");
    expect(failed.error).toBe("provider unavailable");
    expect(telemetry.append).toHaveBeenCalledWith(expect.objectContaining({ type: "voice.call", outcome: "error" }));
  });
});
