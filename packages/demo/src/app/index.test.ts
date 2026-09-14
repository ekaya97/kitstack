import { describe, expect, it } from "vitest";
import { createDemoApp } from "./index.js";

describe("DemoApp", () => {
  it("dogfoods two runs and reset repeatability with real services", async () => {
    const app = await createDemoApp({ url: ":memory:" });
    const registered = app.apps.register({ name: "Claude demo", org: "org-demo" });
    const token = await app.apps.issue(registered.id);
    expect((await app.apps.verify(token)).sub).toBe(registered.id);

    const first = await app.debrief.prepareDebrief("Sell a better workflow");
    await app.voice.start(first.sessionId);
    await app.voice.advance(first.sessionId);
    await app.voice.complete(first.sessionId, "partial");
    const memory = await app.debrief.teachFromCorrection(first.sessionId, "Ask for the next meeting before discussing price.");
    await app.debrief.approve(first.sessionId, memory.memoryId);
    await app.debrief.publish(first.sessionId, memory.memoryId);

    const second = await app.debrief.prepareDebrief("Sell a better workflow");
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.memoryIds).toContain(memory.memoryId);
    expect(second.instructionVersion).toMatch(/^sha256:[a-f0-9]{64}$/);
    await app.voice.start(second.sessionId);
    await app.voice.advance(second.sessionId);
    const completed = await app.voice.complete(second.sessionId, "confirmed");
    expect(completed.status).toBe("confirmed");

    const events = await app.telemetry.query({ orgId: "org-demo" });
    expect(events.some((event) => event.sessionId === first.sessionId && event.memoryIds?.includes(memory.memoryId))).toBe(true);
    expect(events.some((event) => event.sessionId === second.sessionId && event.instructionVersions?.includes(second.instructionVersion))).toBe(true);

    await app.reset();
    expect(app.apps.get(registered.id)?.id).toBe(registered.id);
    expect((await app.apps.verify(token)).sub).toBe(registered.id);
    expect(() => app.debrief.getSession(first.sessionId)).toThrow(`Debrief session "${first.sessionId}" was not found`);
    expect(await app.telemetry.query({ orgId: "org-demo" })).toHaveLength(0);
    const repeat = await app.debrief.prepareDebrief("Sell a better workflow");
    expect(repeat.memoryIds).toEqual([]);
    await app.close();
  });
});
