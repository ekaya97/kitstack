import type { Connector } from "@kitstackco/sdk";
import {
  CRM_CAPABILITIES,
  CrmError,
  type CrmAccountContext,
  type CrmActivity,
  type CrmClient,
  type CrmCompany,
  type CrmContact,
  type CrmDeal,
  type CrmRecordLinks,
  type CrmRecordRef,
} from "./crm.js";

export interface HubSpotConfig {
  /** Defaults to https://api.hubapi.com. */
  baseUrl?: string;
  /** Test seam. */
  fetch?: typeof fetch;
  /** Max related records loaded per type for account context. */
  limit?: number;
}

/** HubSpot scopes the connector needs (granted on the private app). */
export const HUBSPOT_REQUIRED_SCOPES = [
  "crm.objects.companies.read",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.deals.read",
] as const;

// HubSpot-defined association type ids (engagement -> record).
const ASSOCIATION_TYPES = {
  calls: { contact: 194, company: 182, deal: 206 },
  tasks: { contact: 204, company: 192, deal: 216 },
} as const;

const OBJECT_TYPE_IDS = { company: "0-2", contact: "0-1", deal: "0-3" } as const;

/**
 * HubSpot implementation of the CRM capability. Credentials come only from
 * the binding's `accessToken` secret (a private app token); provider schemas,
 * association ids and pagination stay inside this connector.
 */
export const hubspotConnector: Connector<HubSpotConfig, CrmClient> = {
  manifest: {
    id: "crm.hubspot",
    version: "0.1.0",
    capabilities: [...CRM_CAPABILITIES],
    requiredScopes: [...HUBSPOT_REQUIRED_SCOPES],
    secretNames: ["accessToken"],
  },
  async bind(config, secrets) {
    return createHubSpotClient({ ...config, accessToken: await secrets.resolve("accessToken") });
  },
};

export function createHubSpotClient(options: HubSpotConfig & { accessToken: string }): CrmClient {
  const baseUrl = (options.baseUrl ?? "https://api.hubapi.com").replace(/\/$/, "");
  const fetcher = options.fetch ?? globalThis.fetch;
  const limit = options.limit ?? 10;
  if (!options.accessToken?.trim()) throw new CrmError("auth", "HubSpot access token is missing");

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${options.accessToken}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new CrmError("unavailable", "HubSpot could not be reached");
    }
    if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;
    throw await toCrmError(response);
  }

  let portal: Promise<{ portalId: number; uiDomain: string } | null> | undefined;
  const recordUrl = async (type: keyof typeof OBJECT_TYPE_IDS, id: string) => {
    portal ??= call<{ portalId: number; uiDomain?: string }>("GET", "/account-info/v3/details")
      .then((details) => ({ portalId: details.portalId, uiDomain: details.uiDomain ?? "app.hubspot.com" }))
      .catch(() => null);
    const info = await portal;
    return info ? `https://${info.uiDomain}/contacts/${info.portalId}/record/${OBJECT_TYPE_IDS[type]}/${id}` : null;
  };

  async function associatedIds(from: string, fromId: string, to: string): Promise<string[]> {
    const result = await call<{ results?: Array<{ toObjectId: number | string }> }>(
      "GET", `/crm/v4/objects/${from}/${fromId}/associations/${to}?limit=${limit}`,
    );
    return (result.results ?? []).map((row) => String(row.toObjectId)).slice(0, limit);
  }

  async function batchRead(objectType: string, ids: readonly string[], properties: readonly string[]) {
    if (ids.length === 0) return [];
    const result = await call<{ results?: Array<{ id: string; properties: Record<string, string | null> }> }>(
      "POST", `/crm/v3/objects/${objectType}/batch/read`,
      { properties, inputs: ids.map((id) => ({ id })) },
    );
    return result.results ?? [];
  }

  async function search(objectType: string, query: string, properties: readonly string[], max = 5) {
    const result = await call<{ results?: Array<{ id: string; properties: Record<string, string | null> }> }>(
      "POST", `/crm/v3/objects/${objectType}/search`,
      { query, properties, limit: max },
    );
    return result.results ?? [];
  }

  const toContact = async (row: { id: string; properties: Record<string, string | null> }): Promise<CrmContact> => ({
    id: row.id,
    name: [row.properties.firstname, row.properties.lastname].filter(Boolean).join(" ") || row.properties.email || `Contact ${row.id}`,
    email: row.properties.email ?? null,
    phone: row.properties.phone ?? null,
    jobTitle: row.properties.jobtitle ?? null,
    url: await recordUrl("contact", row.id),
  });

  async function recentActivity(companyId: string): Promise<CrmActivity[]> {
    const sources: Array<{ object: string; type: CrmActivity["type"]; properties: string[]; summary: (p: Record<string, string | null>) => string }> = [
      { object: "calls", type: "call", properties: ["hs_timestamp", "hs_call_title", "hs_call_body"], summary: (p) => p.hs_call_title || p.hs_call_body || "Call" },
      { object: "notes", type: "note", properties: ["hs_timestamp", "hs_note_body"], summary: (p) => p.hs_note_body || "Note" },
      { object: "tasks", type: "task", properties: ["hs_timestamp", "hs_task_subject", "hs_task_status"], summary: (p) => `${p.hs_task_subject || "Task"}${p.hs_task_status ? ` (${p.hs_task_status.toLowerCase()})` : ""}` },
      { object: "meetings", type: "meeting", properties: ["hs_timestamp", "hs_meeting_title"], summary: (p) => p.hs_meeting_title || "Meeting" },
    ];
    const batches = await Promise.all(sources.map(async (source) => {
      try {
        const rows = await batchRead(source.object, await associatedIds("companies", companyId, source.object), source.properties);
        return rows.map((row): CrmActivity => ({
          id: row.id,
          type: source.type,
          timestamp: row.properties.hs_timestamp ?? null,
          summary: oneLine(source.summary(row.properties)),
        }));
      } catch (error) {
        // Activity history is optional context; a missing scope must not block the account.
        if (error instanceof CrmError && (error.code === "scope" || error.code === "not_found")) return [];
        throw error;
      }
    }));
    return batches.flat()
      .sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")))
      .slice(0, 5);
  }

  async function create(objectType: "calls" | "tasks", properties: Record<string, string>, links: CrmRecordLinks): Promise<CrmRecordRef> {
    const types = ASSOCIATION_TYPES[objectType];
    const associations = ([
      ["contact", links.contactId],
      ["company", links.companyId],
      ["deal", links.dealId],
    ] as const).flatMap(([kind, id]) => id ? [{
      to: { id },
      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: types[kind] }],
    }] : []);
    const created = await call<{ id: string }>("POST", `/crm/v3/objects/${objectType}`, { properties, associations });
    return { id: created.id };
  }

  return {
    provider: "hubspot",
    async findAccount({ company, contactName }) {
      const companies = await search("companies", company, ["name", "domain", "city"]);
      const match = companies.find((row) => normalize(row.properties.name) === normalize(company)) ?? companies[0];
      const context: CrmAccountContext = { company: null, contacts: [], deals: [], recentActivity: [] };

      if (match) {
        const companyRecord: CrmCompany = {
          id: match.id,
          name: match.properties.name ?? company,
          domain: match.properties.domain ?? null,
          city: match.properties.city ?? null,
          url: await recordUrl("company", match.id),
        };
        const [contactRows, dealRows, activity] = await Promise.all([
          associatedIds("companies", match.id, "contacts").then((ids) => batchRead("contacts", ids, ["firstname", "lastname", "email", "phone", "jobtitle"])),
          associatedIds("companies", match.id, "deals").then((ids) => batchRead("deals", ids, ["dealname", "dealstage", "amount", "closedate"])),
          recentActivity(match.id),
        ]);
        context.company = companyRecord;
        context.contacts = await Promise.all(contactRows.map(toContact));
        context.deals = await Promise.all(dealRows.map(async (row): Promise<CrmDeal> => ({
          id: row.id,
          name: row.properties.dealname ?? `Deal ${row.id}`,
          stage: row.properties.dealstage ?? null,
          amount: row.properties.amount ? Number(row.properties.amount) : null,
          closeDate: row.properties.closedate ?? null,
          url: await recordUrl("deal", row.id),
        })));
        context.recentActivity = activity;
      }

      if (contactName && !context.contacts.some((contact) => normalize(contact.name) === normalize(contactName))) {
        const found = await search("contacts", contactName, ["firstname", "lastname", "email", "phone", "jobtitle"], 3);
        const exact = found.find((row) => normalize([row.properties.firstname, row.properties.lastname].filter(Boolean).join(" ")) === normalize(contactName));
        if (exact) context.contacts.unshift(await toContact(exact));
      }
      return context;
    },

    async logCall(input) {
      const ref = await create("calls", {
        hs_timestamp: new Date(input.occurredAt).toISOString(),
        hs_call_title: input.title,
        hs_call_body: input.summary,
        hs_call_status: "COMPLETED",
        hs_call_direction: input.direction === "inbound" ? "INBOUND" : "OUTBOUND",
      }, input);
      return ref;
    },

    async createTask(input) {
      return create("tasks", {
        hs_timestamp: new Date(input.dueAt).toISOString(),
        hs_task_subject: input.title,
        ...(input.notes ? { hs_task_body: input.notes } : {}),
        hs_task_status: "NOT_STARTED",
        hs_task_priority: "MEDIUM",
        hs_task_type: "TODO",
      }, input);
    },
  };
}

async function toCrmError(response: Response): Promise<CrmError> {
  let category = "";
  try {
    const body = await response.json() as { category?: string };
    category = body.category ?? "";
  } catch {
    // Non-JSON error bodies keep the HTTP status only.
  }
  const status = response.status;
  if (status === 401) return new CrmError("auth", "HubSpot rejected the access token", { status });
  if (status === 403) return new CrmError("scope", `HubSpot denied access${category ? ` (${category})` : ""}; check the private app scopes`, { status });
  if (status === 404) return new CrmError("not_found", "HubSpot record not found", { status });
  if (status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    return new CrmError("rate_limited", "HubSpot rate limit reached", { status, ...(Number.isFinite(retryAfter) ? { retryAfterSeconds: retryAfter } : {}) });
  }
  if (status === 400 || status === 409 || status === 422) return new CrmError("invalid", `HubSpot rejected the request${category ? ` (${category})` : ""}`, { status });
  return new CrmError("unavailable", `HubSpot returned HTTP ${status}`, { status });
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function oneLine(value: string): string {
  const text = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}
