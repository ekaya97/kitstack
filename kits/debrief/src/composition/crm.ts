import { bindConnector } from "@kitstackco/sdk";
import {
  CrmError,
  createInMemoryCrm,
  hubspotConnector,
  HUBSPOT_REQUIRED_SCOPES,
  type CrmAccountContext,
  type CrmClient,
  type CrmDeal,
} from "@kitstackco/crm";
import type { DemoApp } from "./app/index.js";

const CRM_TIMEOUT_MS = 6_000;
const CLOSED_STAGES = new Set(["closedwon", "closedlost"]);

export type CrmSyncResult =
  | { status: "synced"; provider: string; callId: string; taskId: string | null; companyId: string | null; contactId: string | null; dealId: string | null; syncedAt: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; code: string; message: string };

/**
 * Bind the debrief's CRM: HubSpot when HUBSPOT_ACCESS_TOKEN is set (private
 * app token), an in-memory demo CRM with KITSTACK_DEMO_CRM=memory, otherwise
 * none. The kit only ever sees the provider-neutral CrmClient.
 */
export async function bindDebriefCrm(app: DemoApp, env: NodeJS.ProcessEnv = process.env): Promise<CrmClient | undefined> {
  if (env.HUBSPOT_ACCESS_TOKEN?.trim()) {
    return bindConnector(hubspotConnector, {
      connectorId: hubspotConnector.manifest.id,
      scope: { orgId: app.orgId, kitId: "kit:debrief" },
      config: env.HUBSPOT_API_BASE_URL ? { baseUrl: env.HUBSPOT_API_BASE_URL } : {},
      secretRefs: { accessToken: "env:HUBSPOT_ACCESS_TOKEN" },
      grantedScopes: [...HUBSPOT_REQUIRED_SCOPES],
      requiredCapabilities: ["crm.account.read", "crm.activity.write", "crm.task.write"],
    }, { get: async (reference) => reference.startsWith("env:") ? env[reference.slice(4)]?.trim() : undefined });
  }
  if (env.KITSTACK_DEMO_CRM === "memory") return createInMemoryCrm();
  return undefined;
}

/** The customer's CRM account, or null when the CRM has no match or cannot answer in time. */
export async function crmAccountFor(app: DemoApp, crm: CrmClient | undefined, sessionId: string): Promise<CrmAccountContext | null> {
  if (!crm) return null;
  const session = app.debrief.getSession(sessionId);
  const customer = session.customerId ? await app.debrief.getCustomer(session.customerId) : null;
  if (!customer) return null;
  const started = Date.now();
  try {
    const account = await withTimeout(crm.findAccount({ company: customer.company, contactName: customer.contactName }), CRM_TIMEOUT_MS);
    await crmTelemetry(app, sessionId, "crm.read", "success", Date.now() - started);
    return account;
  } catch (error) {
    await crmTelemetry(app, sessionId, "crm.read", "error", Date.now() - started, errorCode(error));
    return null;
  }
}

/** Briefing lines describing the CRM account; empty when there is nothing to say. */
export function crmBriefingLines(account: CrmAccountContext | null): string[] {
  if (!account?.company) return [];
  const lines = [`CRM account: ${account.company.name}${account.company.city ? ` (${account.company.city})` : ""}`];
  const contacts = account.contacts.slice(0, 3).map((contact) => `${contact.name}${contact.jobTitle ? `, ${contact.jobTitle}` : ""}`);
  if (contacts.length) lines.push(`CRM contacts: ${contacts.join("; ")}`);
  const deals = openDeals(account.deals).slice(0, 3).map((deal) => `${deal.name}${deal.stage ? ` [${deal.stage}]` : ""}${deal.amount ? `, ${deal.amount.toLocaleString("de-DE")}` : ""}${deal.closeDate ? `, closes ${deal.closeDate.slice(0, 10)}` : ""}`);
  if (deals.length) lines.push(`Open CRM deals: ${deals.join("; ")}`);
  const activity = account.recentActivity.slice(0, 3).map((item) => `${item.timestamp?.slice(0, 10) ?? "undated"} ${item.type}: ${item.summary}`);
  if (activity.length) lines.push(`Recent CRM activity: ${activity.join("; ")}`);
  return lines;
}

/**
 * Write a confirmed debrief to the CRM: the call with its outcome on the
 * company, contact and open deal, plus a follow-up task when a next step or
 * date was agreed. Idempotent per session; failures never undo confirmation.
 */
export async function syncDebriefToCrm(
  app: DemoApp,
  crm: CrmClient | undefined,
  sessionId: string,
): Promise<CrmSyncResult> {
  if (!crm) return { status: "skipped", reason: "No CRM is configured" };
  const key = `crm-sync/${sessionId}`;
  const existing = await app.storage.objects?.get(key);
  if (existing) {
    const previous = JSON.parse(new TextDecoder().decode(existing.body)) as CrmSyncResult;
    if (previous.status === "synced") return previous;
  }

  const session = app.debrief.getSession(sessionId);
  if (session.state !== "confirmed") return { status: "skipped", reason: `Debrief is ${session.state}, not confirmed` };
  const customer = session.customerId ? await app.debrief.getCustomer(session.customerId) : null;
  if (!customer) return { status: "skipped", reason: "Debrief has no customer" };
  const fields = (await app.debrief.getDraft(sessionId))?.fields ?? {};
  const text = (name: string) => typeof fields[name] === "string" && (fields[name] as string).trim() ? (fields[name] as string).trim() : undefined;

  const started = Date.now();
  let result: CrmSyncResult;
  try {
    const account = await crm.findAccount({ company: customer.company, contactName: customer.contactName });
    if (!account.company) {
      result = { status: "failed", code: "not_found", message: `No CRM company matches "${customer.company}"` };
    } else {
      const contact = account.contacts.find((candidate) => candidate.name.trim().toLowerCase() === customer.contactName.trim().toLowerCase()) ?? null;
      const deal = openDeals(account.deals)[0] ?? null;
      const links = { companyId: account.company.id, contactId: contact?.id ?? null, dealId: deal?.id ?? null };
      const summary = [
        `Sales debrief with ${customer.contactName} (${customer.company}), confirmed in KitStack.`,
        `Goal: ${session.goal}`,
        text("outcome") ? `Outcome: ${text("outcome")}` : undefined,
        text("next_step") ? `Next step: ${text("next_step")}` : undefined,
        text("customer_update") ? `Customer update: ${text("customer_update")}` : undefined,
        text("follow_up_date") ? `Follow-up: ${text("follow_up_date")}` : undefined,
        text("discovered_address") ? `New address: ${text("discovered_address")}` : undefined,
      ].filter(Boolean).join("\n");
      const occurredAt = typeof fields.completed_at === "string" ? fields.completed_at : new Date().toISOString();
      const call = await crm.logCall({ ...links, title: `Sales debrief: ${customer.company}`, summary, occurredAt });
      const task = text("next_step") || text("follow_up_date")
        ? await crm.createTask({
          ...links,
          title: text("next_step") ?? `Follow up with ${customer.contactName}`,
          notes: [`From the sales debrief on ${occurredAt.slice(0, 10)}.`, text("follow_up_date") ? `Agreed follow-up: ${text("follow_up_date")}` : undefined].filter(Boolean).join("\n"),
          dueAt: followUpDue(text("follow_up_date"), occurredAt),
        })
        : null;
      result = { status: "synced", provider: crm.provider, callId: call.id, taskId: task?.id ?? null, ...links, syncedAt: new Date().toISOString() };
    }
  } catch (error) {
    result = { status: "failed", code: errorCode(error), message: error instanceof Error ? error.message : String(error) };
  }

  await app.storage.objects?.put({ key, body: new TextEncoder().encode(JSON.stringify(result)), contentType: "application/json" });
  await crmTelemetry(app, sessionId, "crm.sync", result.status === "synced" ? "success" : "error", Date.now() - started, result.status === "failed" ? result.code : undefined);
  return result;
}

function openDeals(deals: readonly CrmDeal[]): CrmDeal[] {
  return deals.filter((deal) => !deal.stage || !CLOSED_STAGES.has(deal.stage.toLowerCase()));
}

/** An ISO date (or datetime) is used as given; anything else falls back to one week after the call. */
function followUpDue(followUp: string | undefined, occurredAt: string): string {
  if (followUp && /^\d{4}-\d{2}-\d{2}/.test(followUp)) {
    const parsed = new Date(followUp.length === 10 ? `${followUp}T09:00:00Z` : followUp);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const due = new Date(occurredAt);
  due.setUTCDate(due.getUTCDate() + 7);
  due.setUTCHours(9, 0, 0, 0);
  return due.toISOString();
}

function errorCode(error: unknown): string {
  return error instanceof CrmError ? error.code : error instanceof TimeoutError ? "timeout" : "unavailable";
}

async function crmTelemetry(app: DemoApp, sessionId: string, operation: string, outcome: "success" | "error", latencyMs: number, errorCode?: string) {
  await app.telemetry.append({
    id: crypto.randomUUID(), timestamp: new Date().toISOString(), orgId: app.orgId, appId: app.appId,
    sessionId, traceId: sessionId, channel: "system", pluginId: "connector:crm", kitId: "kit:debrief",
    type: "plugin.invoked", operation, latencyMs, outcome, ...(errorCode ? { errorCode } : {}),
  });
}

class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new TimeoutError("CRM request timed out")), ms); }),
  ]).finally(() => clearTimeout(timer));
}
