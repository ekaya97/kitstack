import { describe, expect, it } from "vitest";
import { bindConnector } from "@kitstackco/sdk";
import { CrmError, createInMemoryCrm, hubspotConnector, HUBSPOT_REQUIRED_SCOPES } from "../src/index.js";

type Handler = (body: any, url: URL) => { status?: number; body?: unknown; headers?: Record<string, string> };

/** A fake HubSpot API: routes by "METHOD path" and records every request. */
function fakeHubSpot(routes: Record<string, Handler>) {
  const requests: Array<{ method: string; path: string; body: any; auth: string | null }> = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, path: url.pathname + url.search, body, auth: new Headers(init?.headers).get("authorization") });
    const key = Object.keys(routes).find((candidate) => {
      const [m, p] = candidate.split(" ");
      return m === method && new RegExp(`^${p}$`).test(url.pathname);
    });
    const result = key ? routes[key](body, url) : { status: 404, body: { category: "OBJECT_NOT_FOUND" } };
    return new Response(JSON.stringify(result.body ?? {}), { status: result.status ?? 200, headers: { "content-type": "application/json", ...(result.headers ?? {}) } });
  }) as typeof fetch;
  return { fetcher, requests };
}

async function bind(fetcher: typeof fetch) {
  return bindConnector(hubspotConnector, {
    connectorId: "crm.hubspot",
    scope: { orgId: "org-1", kitId: "kit:debrief" },
    config: { fetch: fetcher },
    secretRefs: { accessToken: "env:HUBSPOT_ACCESS_TOKEN" },
    grantedScopes: [...HUBSPOT_REQUIRED_SCOPES],
  }, { get: async (reference) => reference === "env:HUBSPOT_ACCESS_TOKEN" ? "pat-eu1-test" : undefined });
}

const empty = { results: [] };

describe("HubSpot CRM connector", () => {
  it("loads company, contacts, deals and recent activity for an account", async () => {
    const { fetcher, requests } = fakeHubSpot({
      "GET /account-info/v3/details": () => ({ body: { portalId: 123, uiDomain: "app-eu1.hubspot.com" } }),
      "POST /crm/v3/objects/companies/search": () => ({ body: { results: [
        { id: "9", properties: { name: "Fressnapf GmbH", domain: "fressnapf.de", city: "Krefeld" } },
        { id: "7", properties: { name: "Fressnapf Filiale Köln-Ehrenfeld", domain: null, city: "Köln" } },
      ] } }),
      "GET /crm/v4/objects/companies/7/associations/contacts": () => ({ body: { results: [{ toObjectId: 11 }] } }),
      "GET /crm/v4/objects/companies/7/associations/deals": () => ({ body: { results: [{ toObjectId: 21 }] } }),
      "GET /crm/v4/objects/companies/7/associations/calls": () => ({ body: { results: [{ toObjectId: 31 }] } }),
      "GET /crm/v4/objects/companies/7/associations/notes": () => ({ status: 403, body: { category: "MISSING_SCOPES" } }),
      "GET /crm/v4/objects/companies/7/associations/(tasks|meetings)": () => ({ body: empty }),
      "POST /crm/v3/objects/contacts/batch/read": () => ({ body: { results: [{ id: "11", properties: { firstname: "Anna", lastname: "Becker", email: "anna@example.test", jobtitle: "Store manager" } }] } }),
      "POST /crm/v3/objects/deals/batch/read": () => ({ body: { results: [{ id: "21", properties: { dealname: "Beta rollout", dealstage: "qualifiedtobuy", amount: "12000", closedate: "2026-11-30T00:00:00Z" } }] } }),
      "POST /crm/v3/objects/calls/batch/read": () => ({ body: { results: [{ id: "31", properties: { hs_timestamp: "2026-09-20T10:00:00Z", hs_call_title: "<p>Intro call</p>" } }] } }),
    });
    const crm = await bind(fetcher);
    const account = await crm.findAccount({ company: "Fressnapf Filiale Köln-Ehrenfeld", contactName: "Anna Becker" });

    expect(account.company).toMatchObject({ id: "7", name: "Fressnapf Filiale Köln-Ehrenfeld", url: "https://app-eu1.hubspot.com/contacts/123/record/0-2/7" });
    expect(account.contacts).toEqual([expect.objectContaining({ id: "11", name: "Anna Becker", jobTitle: "Store manager" })]);
    expect(account.deals).toEqual([expect.objectContaining({ id: "21", name: "Beta rollout", stage: "qualifiedtobuy", amount: 12000 })]);
    // A missing notes scope does not block the account; HTML is reduced to one line.
    expect(account.recentActivity).toEqual([{ id: "31", type: "call", timestamp: "2026-09-20T10:00:00Z", summary: "Intro call" }]);
    expect(requests.every((request) => request.auth === "Bearer pat-eu1-test")).toBe(true);
  });

  it("logs a call and creates a task associated with contact, company and deal", async () => {
    const { fetcher, requests } = fakeHubSpot({
      "POST /crm/v3/objects/calls": () => ({ status: 201, body: { id: "c-1" } }),
      "POST /crm/v3/objects/tasks": () => ({ status: 201, body: { id: "t-1" } }),
    });
    const crm = await bind(fetcher);

    await expect(crm.logCall({ title: "Sales debrief", summary: "Outcome: beta agreed", occurredAt: "2026-10-03T15:46:13Z", companyId: "7", contactId: "11", dealId: "21" }))
      .resolves.toEqual({ id: "c-1" });
    await expect(crm.createTask({ title: "Deliver beta", notes: "Follow up", dueAt: "2026-10-17T09:00:00Z", companyId: "7", contactId: "11" }))
      .resolves.toEqual({ id: "t-1" });

    const call = requests.find((request) => request.path === "/crm/v3/objects/calls")!.body;
    expect(call.properties).toMatchObject({ hs_call_title: "Sales debrief", hs_call_body: "Outcome: beta agreed", hs_call_status: "COMPLETED", hs_call_direction: "OUTBOUND" });
    expect(call.associations.map((a: any) => [a.to.id, a.types[0].associationTypeId])).toEqual([["11", 194], ["7", 182], ["21", 206]]);
    const task = requests.find((request) => request.path === "/crm/v3/objects/tasks")!.body;
    expect(task.properties).toMatchObject({ hs_task_subject: "Deliver beta", hs_task_status: "NOT_STARTED", hs_timestamp: "2026-10-17T09:00:00.000Z" });
    expect(task.associations.map((a: any) => [a.to.id, a.types[0].associationTypeId])).toEqual([["11", 204], ["7", 192]]);
  });

  it("normalises provider errors without leaking the token", async () => {
    const cases: Array<[number, CrmError["code"], Record<string, string>?]> = [[401, "auth"], [403, "scope"], [429, "rate_limited", { "retry-after": "10" }], [503, "unavailable"]];
    for (const [status, code, headers] of cases) {
      const { fetcher } = fakeHubSpot({ "POST /crm/v3/objects/companies/search": () => ({ status, body: { category: "X", message: "pat-eu1-test leaked?" }, headers }) });
      const crm = await bind(fetcher);
      const error = await crm.findAccount({ company: "Acme" }).catch((caught) => caught);
      expect(error).toBeInstanceOf(CrmError);
      expect(error.code).toBe(code);
      expect(error.message).not.toContain("pat-eu1-test");
      if (code === "rate_limited") expect(error.retryAfterSeconds).toBe(10);
    }
  });

  it("refuses to bind without the required scopes or the token", async () => {
    const { fetcher } = fakeHubSpot({});
    await expect(bindConnector(hubspotConnector, {
      connectorId: "crm.hubspot", scope: { orgId: "org-1", kitId: "kit:debrief" }, config: { fetch: fetcher },
      secretRefs: { accessToken: "env:HUBSPOT_ACCESS_TOKEN" }, grantedScopes: ["crm.objects.contacts.read"],
    }, { get: async () => "pat" })).rejects.toThrow(/not granted/);
    await expect(bindConnector(hubspotConnector, {
      connectorId: "crm.hubspot", scope: { orgId: "org-1", kitId: "kit:debrief" }, config: { fetch: fetcher },
      secretRefs: { accessToken: "env:HUBSPOT_ACCESS_TOKEN" }, grantedScopes: [...HUBSPOT_REQUIRED_SCOPES],
    }, { get: async () => undefined })).rejects.toThrow(/not configured/);
  });
});

describe("in-memory CRM", () => {
  it("implements the same contract and shows its own writes as activity", async () => {
    const crm = createInMemoryCrm({ companies: [{ id: "co-1", name: "Acme GmbH", contacts: [{ id: "ct-1", name: "Jane Doe" }], deals: [] }] });
    await crm.logCall({ title: "Debrief", summary: "ok", occurredAt: "2026-10-03T10:00:00Z", companyId: "co-1" });
    const account = await crm.findAccount({ company: "acme gmbh", contactName: "Jane Doe" });
    expect(account.company?.id).toBe("co-1");
    expect(account.recentActivity).toEqual([expect.objectContaining({ type: "call", summary: "Debrief" })]);
    expect((await crm.findAccount({ company: "Unknown" })).company).toBeNull();
  });
});
