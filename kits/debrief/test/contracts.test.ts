import { describe, expect, it } from "vitest";
import { normalizeDebriefSchedule } from "../src/contracts";
import { DeterministicScheduler, FakeClock, presenterRequest } from "./fixtures";

describe("presenter contract", () => {
  it("resolves a time-only callback, preserves the prebrief end, and schedules the call after the buffer", () => {
    const clock = new FakeClock(new Date("2026-09-15T18:00:00.000Z"));
    const schedule = normalizeDebriefSchedule(presenterRequest("22:05"), clock.now());
    expect(schedule.prebrief_ends_at).toBe("2026-09-15T20:05:00.000Z");
    expect(schedule.scheduled_call_at).toBe("2026-09-15T20:10:00.000Z");
  });

  it("walks the deterministic wait-to-call sequence", async () => {
    const clock = new FakeClock(new Date("2026-09-15T18:00:00.000Z"));
    const schedule = normalizeDebriefSchedule(presenterRequest("20:05"), clock.now());
    const scheduler = new DeterministicScheduler(clock);
    const states: string[] = ["prebriefed"];
    scheduler.schedule(schedule.scheduled_call_at, () => { states.push("calling"); });
    expect(scheduler.pending).toBe(1);
    await scheduler.runDue();
    expect(states).toEqual(["prebriefed"]);
    clock.advance(15 * 60 * 1000);
    await scheduler.runDue();
    states.push("debrief_ready", "confirmed", "timeline_updated");
    expect(states).toEqual(["prebriefed", "calling", "debrief_ready", "confirmed", "timeline_updated"]);
  });

  it.each([
    ["", "callback_at is required"],
    ["22:05", "callback_timezone is required"],
  ])("rejects incomplete callback input (%s)", (callbackAt, message) => {
    expect(() => normalizeDebriefSchedule({ ...presenterRequest(callbackAt), callback_timezone: callbackAt ? "" : "Europe/Berlin" }, new Date("2026-09-15T18:00:00.000Z"))).toThrow(message);
  });

  it("rejects a callback in the past or beyond the 24-hour demo window", () => {
    const now = new Date("2026-09-15T18:00:00.000Z");
    expect(() => normalizeDebriefSchedule({ ...presenterRequest("2026-09-15T17:00:00Z") }, now)).toThrow("in the future");
    expect(() => normalizeDebriefSchedule({ ...presenterRequest("2026-09-17T18:01:00Z") }, now)).toThrow("within the next 24 hours");
  });
});
