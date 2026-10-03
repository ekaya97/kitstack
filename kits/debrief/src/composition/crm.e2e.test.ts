import { afterEach, describe, expect, it } from "vitest";
import { createConnectorRegistry } from "@kitstackco/sdk";
import { CRM_CONNECTOR_KEY, CrmError, createInMemoryCrm, type CrmClient } from "@kitstackco/crm";
import { createDemoApp, type DemoApp } from "./app/index.js";
import { kitCall, kitView, mcpRequest } from "../transports/test-support.js";

let app: DemoApp | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

const seededCrm = () => createInMemoryCrm({
  companies: [{
    id: "co-7", name: "Fressnapf Filiale Köln-Ehrenfeld", city: "Köln",
    contacts: [{ id: "ct-11", name: "Anna Becker", jobTitle: "Store manager" }],
    deals: [
      { id: "dl-1", name: "Old pilot", stage: "closedlost" },
      { id: "dl-21", name: "Beta rollout", stage: "qualifiedtobuy", amount: 12000, closeDate: "2026-11-30" },
    ],
    activity: [{ id: "a-1", type: "note", timestamp: "2026-09-20T10:00:00Z", summary: "Asked about pricing" }],
  }],
});

async function call<T = any>(name: string, args: Record<string, unknown>, crm?: CrmClient): Promise<T> {
  const response = await mcpRequest(app!, { body: { id: 1, method: "tools/call", params: kitCall(name, args) } }, {
    connectors: createConnectorRegistry({ [CRM_CONNECTOR_KEY]: crm }),
  });
  const result = (response.body as any).result;
  if (result.isError) throw new Error(result.content[0].text);
  return JSON.parse(result.content[0].text) as T;
}

async function preparedAndCalled(crm: CrmClient) {
  const prepared = await call("prepare_debrief", {
    goal: "Agree the beta next step", company: "Fressnapf Filiale Köln-Ehrenfeld", contact_name: "Anna Becker",
    location: "Köln", callback_at: new Date(Date.now() + 3_600_000).toISOString(), callback_timezone: "Europe/Berlin",
  }, crm);
  await app!.debrief.markCalling(prepared.sessionId);
  await call("update_debrief_draft", { session_id: prepared.sessionId, outcome: "Beta agreed", next_step: "Deliver the beta build", follow_up_date: "2026-10-17" }, crm);
  await app!.debrief.awaitConfirmation(prepared.sessionId);
  return prepared;
}

describe("debrief with a CRM", () => {
  it("briefs from the CRM and writes the call and follow-up task on confirmation", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const crm = seededCrm();
    const prepared = await preparedAndCalled(crm);
    expect(prepared.crm_context).toEqual(expect.arrayContaining([
      "CRM account: Fressnapf Filiale Köln-Ehrenfeld (Köln)",
      expect.stringContaining("Beta rollout [qualifiedtobuy]"),
    ]));
    expect(prepared.crm_context.join(" ")).not.toContain("Old pilot");

    const confirmed = await call("confirm_debrief_draft", { session_id: prepared.sessionId }, crm);
    expect(confirmed.state).toBe("confirmed");
    expect(confirmed.crm).toMatchObject({ status: "synced", provider: "memory", companyId: "co-7", contactId: "ct-11", dealId: "dl-21" });
    expect(crm.calls).toEqual([expect.objectContaining({ companyId: "co-7", contactId: "ct-11", dealId: "dl-21", summary: expect.stringContaining("Outcome: Beta agreed") })]);
    expect(crm.tasks).toEqual([expect.objectContaining({ title: "Deliver the beta build", dueAt: "2026-10-17T09:00:00.000Z" })]);

    // Idempotent: a retry returns the stored result and writes nothing new.
    const retried = await call("sync_debrief_to_crm", { session_id: prepared.sessionId }, crm);
    expect(retried).toEqual(confirmed.crm);
    expect(crm.calls).toHaveLength(1);

    const view = await mcpRequest(app, { body: { id: 2, method: "tools/call", params: kitView("prebrief") } }, {
      connectors: createConnectorRegistry({ [CRM_CONNECTOR_KEY]: crm }),
    });
    expect(JSON.parse((view.body as any).result.content[0].text).data.known).toEqual(expect.arrayContaining([expect.stringContaining("CRM account")]));
  });

  it("keeps the confirmation when the CRM fails, and lets the operator retry", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const healthy = seededCrm();
    let down = true;
    const flaky: CrmClient = {
      provider: "memory",
      findAccount: (query) => down ? Promise.reject(new CrmError("unavailable", "HubSpot returned HTTP 503")) : healthy.findAccount(query),
      logCall: (input) => healthy.logCall(input),
      createTask: (input) => healthy.createTask(input),
    };
    const prepared = await preparedAndCalled(flaky);
    const confirmed = await call("confirm_debrief_draft", { session_id: prepared.sessionId }, flaky);
    expect(confirmed.state).toBe("confirmed");
    expect(confirmed.crm).toMatchObject({ status: "failed", code: "unavailable" });

    down = false;
    await expect(call("sync_debrief_to_crm", { session_id: prepared.sessionId }, flaky)).resolves.toMatchObject({ status: "synced" });
    expect(healthy.calls).toHaveLength(1);
  });

  it("reports when no CRM is configured", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const prepared = await call("prepare_rehearsal", { goal: "Rehearse" });
    await expect(call("get_crm_context", { session_id: prepared.sessionId })).resolves.toEqual({ configured: false });
  });
});
