import { describe, expect, it, vi } from "vitest";
import { VoiceSimulator } from "./index.js";

function fixture() {
  const sessions = new Map<string, { state: any; memoryIds: string[] }>();
  const debrief = {
    markCalling: vi.fn(async (id: string) => { sessions.get(id)!.state = "calling"; }),
    awaitConfirmation: vi.fn(async (id: string) => { sessions.get(id)!.state = "awaiting_confirmation"; }),
    markPartial: vi.fn(async (id: string) => { sessions.get(id)!.state = "partial"; }),
    confirmDebrief: vi.fn(async (id: string) => { sessions.get(id)!.state = "confirmed"; }),
    markFailed: vi.fn(async (id: string) => { sessions.get(id)!.state = "failed"; }),
    getSession: vi.fn((id: string) => ({ sessionId: id, state: sessions.get(id)!.state, memoryIds: [] })),
  };
  const telemetry = { append: vi.fn(async (event: any) => event) };
  const add = (id: string) => sessions.set(id, { state: "prepared", memoryIds: [] });
  return { debrief, telemetry, add, simulator: () => new VoiceSimulator({ debrief, telemetry, orgId: "org-demo", appId: "app-sales", createId: (() => { let n = 0; return () => `event-${++n}`; })(), now: () => "2026-01-01T00:00:00.000Z" }) };
}

describe("German simulator voice lifecycle", () => {
  it("runs a full German call with explicit lifecycle", async () => {
    const f = fixture(); f.add("call-1"); const voice = f.simulator();
    const started = await voice.start("call-1");
    expect(started).toMatchObject({ provider: "simulator", status: "calling", locale: "de-DE", recording: false, retention: false });
    expect(started.turns).toHaveLength(5); expect(started.turns.every((t) => t.locale === "de-DE")).toBe(true);
    expect((await voice.advance("call-1")).status).toBe("awaiting_confirmation");
    expect((await voice.complete("call-1", "confirmed")).status).toBe("confirmed");
    expect(f.debrief.markCalling).toHaveBeenCalledWith("call-1");
  });
  it("supports partial completion for teach-compatible follow-up", async () => {
    const f = fixture(); f.add("teach-1"); const voice = f.simulator(); await voice.start("teach-1"); await voice.advance("teach-1");
    expect((await voice.complete("teach-1", "partial"))).toMatchObject({ status: "partial", debriefState: "partial" });
    expect(f.debrief.markPartial).toHaveBeenCalledWith("teach-1");
    expect(f.debrief.confirmDebrief).not.toHaveBeenCalled();
  });
  it("marks provider/start failures", async () => {
    const f = fixture(); f.add("fail-1"); const voice = f.simulator(); await voice.start("fail-1");
    const result = await voice.fail("fail-1", new Error("provider unavailable"));
    expect(result.status).toBe("failed"); expect(f.debrief.markFailed).toHaveBeenCalledWith("fail-1", expect.any(Error));
  });
  it("converts markCalling and telemetry startup errors into failed results", async () => {
    const f = fixture(); f.add("startup-fail"); f.debrief.markCalling.mockRejectedValueOnce(new Error("provider unavailable"));
    const result = await f.simulator().start("startup-fail");
    expect(result).toMatchObject({ status: "failed", error: "provider unavailable" });
    expect(f.debrief.markFailed).toHaveBeenCalledWith("startup-fail", expect.any(Error));
    const g = fixture(); g.add("telemetry-fail"); g.telemetry.append.mockRejectedValueOnce(new Error("telemetry unavailable"));
    const telemetryResult = await g.simulator().start("telemetry-fail");
    expect(telemetryResult).toMatchObject({ status: "failed", error: "telemetry unavailable" });
    expect(g.debrief.markFailed).toHaveBeenCalledWith("telemetry-fail", expect.any(Error));
  });
  it("keeps session continuity across status reads", async () => {
    const f = fixture(); f.add("same"); const voice = f.simulator(); await voice.start("same");
    expect(voice.status("same")).toMatchObject({ sessionId: "same", status: "calling", debriefState: "calling" });
    await voice.advance("same"); expect(voice.status("same").debriefState).toBe("awaiting_confirmation");
  });
  it("returns and emits JSON without transcript or audio bodies", async () => {
    const f = fixture(); f.add("json-1"); const voice = f.simulator(); const result = await voice.start("json-1");
    const json = JSON.stringify({ result, event: f.telemetry.append.mock.calls[0][0] });
    expect(json).not.toMatch(/transcript|audio/i);
    expect(f.telemetry.append).toHaveBeenCalledWith(expect.objectContaining({ type: "voice.call", outcome: "started", model: "simulator-german-sales-v1" }));
  });
});
