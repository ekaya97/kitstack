import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDemoApp } from "./index.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

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
    expect(await app.scheduler.list("org-demo")).toEqual([]);
    const repeat = await app.debrief.prepareDebrief("Sell a better workflow");
    expect(repeat.memoryIds).toEqual([]);
    await app.close();
  });

  it("reloads a prepared customer session after a process restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kitstack-demo-sessions-"));
    temporaryDirectories.push(directory);
    const url = `file:${join(directory, "demo.db")}`;
    const callbackAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const scheduledCallAt = new Date(Date.parse(callbackAt) + 5 * 60 * 1000).toISOString();
    const firstApp = await createDemoApp({ url, orgId: "org-demo" });
    const prepared = await firstApp.debrief.prepareDebrief({
      goal: "Prepare the Acme renewal",
      company: "  Acme   Corp ",
      contactName: " John Doe ",
      location: " Köln   Café ",
      callbackAt,
      scheduledCallAt,
      callbackTimezone: "Europe/Berlin",
      bufferMinutes: 5,
    });
    expect(prepared.customerId).not.toBeNull();
    const events = await firstApp.debrief.listCustomerEvents(prepared.customerId!);
    expect(events).toEqual([expect.objectContaining({
      type: "prebrief",
      payload: expect.objectContaining({ company: "Acme Corp", contact_name: "John Doe", location: "Köln Café" }),
    })]);
    await firstApp.close();

    const restartedApp = await createDemoApp({ url, orgId: "org-demo" });
    expect(restartedApp.debrief.getSession(prepared.sessionId)).toMatchObject({
      sessionId: prepared.sessionId,
      customerId: prepared.customerId,
      callbackAt,
      scheduledCallAt,
    });
    await restartedApp.close();
  });

  it("replays approved memories only within the customer and organization scope", async () => {
    const directory = mkdtempSync(join(tmpdir(), "kitstack-demo-customer-scope-"));
    temporaryDirectories.push(directory);
    const url = `file:${join(directory, "demo.db")}`;
    const app = await createDemoApp({ url, orgId: "org-demo" });
    const acmeOne = await app.debrief.prepareDebrief({ goal: "Sell", company: "Acme Corp", contactName: "John Doe", location: "Köln Café" });
    await app.debrief.markCalling(acmeOne.sessionId);
    await app.debrief.awaitConfirmation(acmeOne.sessionId);
    const learned = await app.debrief.teachFromCorrection(acmeOne.sessionId, "Ask for the next meeting before price.");
    await app.debrief.approve(acmeOne.sessionId, learned.memoryId);

    const acmeTwo = await app.debrief.prepareDebrief({ goal: "Sell", company: " acme   corp ", contactName: "john doe", location: "Berlin Office" });
    expect(acmeTwo.customerId).toBe(acmeOne.customerId);
    expect(acmeTwo.memoryIds).toContain(learned.memoryId);
    expect((await app.debrief.listCustomerEvents(acmeTwo.customerId!)).map((event) => event.type)).toEqual(["prebrief", "note", "prebrief"]);

    const otherCustomer = await app.debrief.prepareDebrief({ goal: "Sell", company: "Other Corp", contactName: "Jane Doe", location: "Hamburg Office" });
    expect(otherCustomer.customerId).not.toBe(acmeOne.customerId);
    expect(otherCustomer.memoryIds).toEqual([]);

    const otherOrg = await createDemoApp({ url, orgId: "org-other" });
    expect(await otherOrg.debrief.getCustomer(acmeOne.customerId!)).toBeNull();
    expect(await otherOrg.debrief.listCustomerEvents(acmeOne.customerId!)).toEqual([]);
    await otherOrg.close();
    await app.close();
  });

  it("reset removes customer/session/event/draft rows but preserves app credentials", async () => {
    const app = await createDemoApp({ url: ":memory:" });
    const registered = app.apps.register({ name: "Claude demo", org: "org-demo" });
    const prepared = await app.debrief.prepareDebrief({ goal: "Sell", company: "Acme Corp", contactName: "John Doe", location: "Köln Café" });
    await app.debrief.saveDraft(prepared.sessionId, { next_step: "send proposal" });
    await app.reset();
    for (const table of ["demo_customers", "demo_customer_events", "demo_debrief_sessions", "demo_debrief_drafts"]) {
      const result = await app.client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
      expect(Number(result.rows[0].count)).toBe(0);
    }
    expect(app.apps.get(registered.id)?.id).toBe(registered.id);
    await app.close();
  });
});
