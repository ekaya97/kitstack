import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { createDemoApp, type DemoApp } from "./app/index.js";
import { createDebriefKitServer } from "./host.js";
import { handleDemoAppRequest } from "../transports/http/app.js";
import { createTenantScheduledCallPoller } from "../transports/server.js";
import { kitCall, kitView, mcpRequest } from "../transports/test-support.js";
import { personalOrgId, VOICE_AGENT_PRINCIPAL } from "../tenancy.js";
import { LibsqlVoiceDestinationStore } from "../functions/voice-destinations.js";

const SECRET = "a-router-to-voice-internal-secret-of-32-bytes";
const ENV = {
  KITSTACK_DEMO_INTERNAL_SECRET: SECRET,
  // The deployed default: the router decides who works in the operator org.
  KITSTACK_DEMO_INTERNAL_USER_ORG_ALLOWLIST: "*=org-demo",
};

let app: DemoApp | undefined;
let previousEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  previousEnv = Object.fromEntries(Object.keys(ENV).map((name) => [name, process.env[name]]));
  Object.assign(process.env, ENV);
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  for (const [name, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function sign(userId: string, org: string): Promise<string> {
  return new SignJWT({ org, kit: "debrief", req: crypto.randomUUID(), trace: crypto.randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
    .sign(new TextEncoder().encode(SECRET));
}

/** One router-signed MCP call as `userId` acting in `org`. */
async function callAs(userId: string, org: string, params: ReturnType<typeof kitCall>) {
  const response = await mcpRequest(app!, {
    headers: { authorization: `Bearer ${await sign(userId, org)}` },
    body: { id: crypto.randomUUID(), method: "tools/call", params },
  });
  const body = response.body as { result?: { isError?: boolean; content: Array<{ text: string }> }; error?: { message: string } };
  const text = body?.result?.content?.[0]?.text ?? body?.error?.message ?? "";
  let data: Record<string, any> | undefined;
  try { data = JSON.parse(text); } catch { data = undefined; }
  return { status: response.status, isError: Boolean(body?.error || body?.result?.isError), text, data };
}

/** A verified phone for `userId`, as if they had completed register_phone/verify_phone. */
async function verifiedPhone(userId: string, org: string, e164 = "+491701234567") {
  const store = new LibsqlVoiceDestinationStore(app!.client);
  const now = new Date().toISOString();
  await store.upsertStart({ orgId: org, userId, e164, startCount: 1, startWindowAt: now, now });
  await store.markVerified(org, userId, now);
}

function prepareParams(company: string) {
  return kitCall("prepare_debrief", {
    goal: "Prepare the next sales conversation",
    company,
    contact_name: "John Doe",
    location: "Köln Café",
    callback_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    callback_timezone: "Europe/Berlin",
  });
}

const USER_A = "user-a";
const USER_B = "user-b";
const ORG_A = personalOrgId(USER_A);
const ORG_B = personalOrgId(USER_B);

describe("per-user debrief tenancy", () => {
  it("keeps one user's sessions, customers, memories and telemetry away from another", async () => {
    app = await createDemoApp({ url: ":memory:", mcpAuthMode: "internal-signed" });

    await verifiedPhone(USER_A, ORG_A);
    await verifiedPhone(USER_B, ORG_B);
    const preparedA = await callAs(USER_A, ORG_A, prepareParams("Acme Corp"));
    expect(preparedA.isError).toBe(false);
    const sessionA = preparedA.data!.session_id as string;
    const customerA = preparedA.data!.customer_id as string;
    const workspaceA = await app.tenants.forOrg(ORG_A);
    expect(workspaceA.debrief.getSession(sessionA).orgId).toBe(ORG_A);
    await workspaceA.debrief.markCalling(sessionA);
    await workspaceA.debrief.awaitConfirmation(sessionA);
    const learned = await workspaceA.debrief.teachFromCorrection(sessionA, "Ask about the budget owner first.");
    await workspaceA.debrief.approve(sessionA, learned.memoryId);

    // B cannot read A's session, draft, debrief or Views by id.
    for (const cmd of ["get_session", "get_debrief", "get_debrief_draft", "get_debrief_for_confirmation"]) {
      const denied = await callAs(USER_B, ORG_B, kitCall(cmd, { session_id: sessionA }));
      expect(denied.isError, cmd).toBe(true);
      expect(denied.text).not.toContain("Acme");
    }
    const timeline = await callAs(USER_B, ORG_B, kitView("customer-timeline", { session_id: sessionA }));
    // View loads report a failed loader as `{ data: null, error }`.
    expect(timeline.data).toMatchObject({ data: null, error: expect.stringContaining(`Debrief session "${sessionA}" was not found`) });
    const prebrief = await callAs(USER_B, ORG_B, kitView("prebrief"));
    expect(prebrief.data).toMatchObject({ data: null, error: expect.stringContaining("No prepared customer prebrief") });
    expect(prebrief.text).not.toContain("Acme");

    // The same company in B's org is a new customer without A's memory or history.
    const preparedB = await callAs(USER_B, ORG_B, prepareParams("Acme Corp"));
    expect(preparedB.isError).toBe(false);
    expect(preparedB.data!.customer_id).not.toBe(customerA);
    expect(preparedB.data!.memoryIds).toEqual([]);
    expect(preparedB.data!.prebrief_sections.open_items).not.toContain("Approved memory: Ask about the budget owner first.");
    const workspaceB = await app.tenants.forOrg(ORG_B);
    expect(await workspaceB.debrief.getCustomer(customerA)).toBeNull();
    expect(await workspaceB.debrief.listCustomerEvents(customerA)).toEqual([]);

    // A's own reads still work.
    const ownRead = await callAs(USER_A, ORG_A, kitCall("get_session", { session_id: sessionA }));
    expect(ownRead.isError).toBe(false);
    expect(ownRead.data).toMatchObject({ sessionId: sessionA, orgId: ORG_A });

    // Telemetry: B's observability is B's organization only.
    const observed = await handleDemoAppRequest(app, {
      method: "GET",
      path: "/api/demo/observability",
      headers: { authorization: `Bearer ${await sign(USER_B, ORG_B)}` },
    });
    expect(observed.status).toBe(200);
    const snapshot = observed.body as { events: Array<{ orgId: string; customerId: string | null; memoryIds?: string[] }>; schedulerJobs: Array<{ orgId: string }>; customers: Array<{ id: string }> };
    expect(snapshot.events.length).toBeGreaterThan(0);
    expect(snapshot.events.every((event) => event.orgId === ORG_B)).toBe(true);
    expect(snapshot.events.some((event) => event.customerId === customerA || event.memoryIds?.includes(learned.memoryId))).toBe(false);
    expect((await app.telemetry.query({ orgId: ORG_A })).some((event) => event.customerId === customerA)).toBe(true);
    expect(snapshot.schedulerJobs.every((job) => job.orgId === ORG_B)).toBe(true);
    expect(snapshot.customers.map((customer) => customer.id)).not.toContain(customerA);
    const sessionRoute = await handleDemoAppRequest(app, {
      method: "GET",
      path: `/api/demo/sessions/${sessionA}`,
      headers: { authorization: `Bearer ${await sign(USER_B, ORG_B)}` },
    });
    expect(sessionRoute.status).toBe(400);

    // Nothing of either prospect reached the operator organization.
    expect(app.orgId).toBe("org-demo");
    expect(app.debrief.getLatestSession()).toBeNull();
    expect((await app.telemetry.query({ orgId: "org-demo" })).some((event) => event.sessionId === sessionA)).toBe(false);
  });

  it("refuses a token for another user's personal organization", async () => {
    app = await createDemoApp({ url: ":memory:", mcpAuthMode: "internal-signed" });
    const forged = await callAs(USER_B, ORG_A, kitCall("get_session", { session_id: "anything" }));
    expect(forged.status).toBe(403);
  });

  it("keeps the operator on org-demo with the existing data", async () => {
    app = await createDemoApp({ url: ":memory:", mcpAuthMode: "internal-signed" });
    const existing = await app.debrief.prepareDebrief({ goal: "Sell", company: "Operator Corp", contactName: "Jane Doe", location: "Berlin" });

    const read = await callAs("operator-1", "org-demo", kitCall("get_session", { session_id: existing.sessionId }));
    expect(read.isError).toBe(false);
    expect(read.data).toMatchObject({ sessionId: existing.sessionId, orgId: "org-demo" });
    await verifiedPhone("operator-1", "org-demo");
    const prepared = await callAs("operator-1", "org-demo", prepareParams("Second Corp"));
    expect(app.debrief.getSession(prepared.data!.session_id).orgId).toBe("org-demo");
    expect(await app.scheduler.list("org-demo")).toEqual([expect.objectContaining({ sessionId: prepared.data!.session_id })]);
    // A prospect never sees the operator's sessions.
    const prospect = await callAs(USER_A, ORG_A, kitCall("get_session", { session_id: existing.sessionId }));
    expect(prospect.isError).toBe(true);
  });

  it("runs voice agent tool calls in the organization that owns the session", async () => {
    app = await createDemoApp({ url: ":memory:", mcpAuthMode: "internal-signed" });
    const workspaceA = await app.tenants.forOrg(ORG_A);
    const prepared = await workspaceA.debrief.prepareDebrief({ goal: "Sell", company: "Acme Corp", contactName: "John Doe", location: "Köln" });
    await workspaceA.debrief.markCalling(prepared.sessionId);
    const server = createDebriefKitServer(app, { transport: "http" });

    const result = await server.executeTool("debrief", "update_debrief_draft", { session_id: prepared.sessionId, next_step: "Send proposal" }, VOICE_AGENT_PRINCIPAL);
    expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
    expect((await workspaceA.debrief.getDraft(prepared.sessionId))?.fields).toMatchObject({ next_step: "Send proposal" });
    await expect(app.debrief.getDraft(prepared.sessionId)).rejects.toThrow("was not found");
  });

  it("resolves a session's workspace from the database after a restart", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const workspaceA = await app.tenants.forOrg(ORG_A);
    const prepared = await workspaceA.debrief.prepareDebrief({ goal: "Sell", company: "Acme Corp", contactName: "John Doe", location: "Köln" });
    workspaceA.debrief.clearSessions();
    const resolved = await app.tenants.forSession(prepared.sessionId);
    expect(resolved.orgId).toBe(ORG_A);
    expect(resolved.debrief.getSession(prepared.sessionId).orgId).toBe(ORG_A);
    await expect(app.tenants.forSession("missing-session")).rejects.toThrow('Debrief session "missing-session" was not found');
  });
});

describe("one scheduled-call poller for every organization", () => {
  it("claims due calls across organizations with one query per tick and starts each in its own workspace", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const callbackAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const schedule = async (workspace: DemoApp, company: string) => {
      const prepared = await workspace.plugins.dispatch<Record<string, unknown>, Record<string, unknown>>("kit:debrief", {
        operation: "prepare", goal: "Sell", company, contactName: "John Doe", location: "Köln",
        callbackAt, callbackTimezone: "Europe/Berlin",
      }, { orgId: workspace.orgId, appId: null, sessionId: "test", traceId: "test", telemetry: workspace.telemetry });
      return String(prepared.session_id);
    };
    const operatorSession = await schedule(app, "Operator Corp");
    const sessionA = await schedule(await app.tenants.forOrg(ORG_A), "Acme Corp");
    const sessionB = await schedule(await app.tenants.forOrg(ORG_B), "Beta Corp");

    const claimDue = vi.spyOn(app.scheduler, "claimDue");
    const started: Array<{ orgId: string; sessionId: string; workspaceOrg: string; owned: boolean }> = [];
    const poller = createTenantScheduledCallPoller(app, async (workspace, job) => {
      let owned = true;
      try { workspace.debrief.getSession(job.sessionId); } catch { owned = false; }
      started.push({ orgId: job.orgId, sessionId: job.sessionId, workspaceOrg: workspace.orgId, owned });
      return `call-${job.sessionId}`;
    }, { workerId: "shared-worker", now: () => new Date(Date.now() + 60 * 60 * 1000).toISOString() });

    for (let tick = 0; tick < 4; tick += 1) await poller.pollOnce();

    expect(claimDue).toHaveBeenCalledTimes(4);
    expect(claimDue.mock.calls.every(([input]) => input.orgId === undefined)).toBe(true);
    expect(started).toHaveLength(3);
    expect(new Map(started.map((entry) => [entry.sessionId, entry.orgId]))).toEqual(new Map([
      [operatorSession, "org-demo"],
      [sessionA, ORG_A],
      [sessionB, ORG_B],
    ]));
    expect(started.every((entry) => entry.workspaceOrg === entry.orgId && entry.owned)).toBe(true);
    for (const [orgId, sessionId] of [["org-demo", operatorSession], [ORG_A, sessionA], [ORG_B, sessionB]] as const) {
      expect(await app.scheduler.list(orgId)).toEqual([expect.objectContaining({ sessionId, status: "started", providerCallId: `call-${sessionId}` })]);
    }
    expect(await app.tenants.sessionIdForProviderCall(`call-${sessionA}`)).toBe(sessionA);
  });

  it("marks a failed start on the owning organization's session", async () => {
    app = await createDemoApp({ url: ":memory:" });
    const workspaceA = await app.tenants.forOrg(ORG_A);
    const prepared = await workspaceA.debrief.prepareDebrief({ goal: "Sell", company: "Acme Corp", contactName: "John Doe", location: "Köln" });
    await app.scheduler.schedule({ orgId: ORG_A, sessionId: prepared.sessionId, scheduledAt: new Date(Date.now() - 1000).toISOString() });
    const poller = createTenantScheduledCallPoller(app, async () => { throw new Error("provider down"); }, { workerId: "shared-worker" });

    const failed = await poller.pollOnce();
    expect(failed).toMatchObject({ orgId: ORG_A, status: "failed", error: expect.stringContaining("provider down") });
    expect(workspaceA.debrief.getSession(prepared.sessionId).state).toBe("failed");
  });
});
