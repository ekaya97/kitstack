import type { Connector } from "@kitstackco/sdk";
import {
  CRM_CAPABILITIES,
  type CrmAccountContext,
  type CrmActivity,
  type CrmCallLog,
  type CrmClient,
  type CrmCompany,
  type CrmContact,
  type CrmDeal,
  type CrmTaskInput,
} from "./crm.js";

export interface InMemoryCrmSeed {
  companies?: Array<CrmCompany & { contacts?: CrmContact[]; deals?: CrmDeal[]; activity?: CrmActivity[] }>;
}

/** Inspectable in-memory CRM for local runs and tests; same contract as a real provider. */
export interface InMemoryCrm extends CrmClient {
  readonly calls: Array<CrmCallLog & { id: string }>;
  readonly tasks: Array<CrmTaskInput & { id: string }>;
}

export function createInMemoryCrm(seed: InMemoryCrmSeed = {}): InMemoryCrm {
  const companies = (seed.companies ?? []).map((company) => ({ ...company }));
  const calls: Array<CrmCallLog & { id: string }> = [];
  const tasks: Array<CrmTaskInput & { id: string }> = [];
  let sequence = 0;
  const normalize = (value: string) => value.trim().toLowerCase();

  return {
    provider: "memory",
    calls,
    tasks,
    async findAccount({ company, contactName }): Promise<CrmAccountContext> {
      const match = companies.find((candidate) => normalize(candidate.name) === normalize(company))
        ?? companies.find((candidate) => normalize(candidate.name).includes(normalize(company)));
      if (!match) return { company: null, contacts: [], deals: [], recentActivity: [] };
      const { contacts = [], deals = [], activity = [], ...record } = match;
      const ownActivity: CrmActivity[] = [
        ...calls.filter((call) => call.companyId === match.id).map((call) => ({ id: call.id, type: "call" as const, timestamp: call.occurredAt, summary: call.title })),
        ...tasks.filter((task) => task.companyId === match.id).map((task) => ({ id: task.id, type: "task" as const, timestamp: task.dueAt, summary: `${task.title} (not_started)` })),
      ];
      const ordered = [...contacts].sort((a, b) => Number(normalize(b.name) === normalize(contactName ?? "")) - Number(normalize(a.name) === normalize(contactName ?? "")));
      return {
        company: record,
        contacts: ordered,
        deals,
        recentActivity: [...ownActivity, ...activity].sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? ""))).slice(0, 5),
      };
    },
    async logCall(input) {
      const id = `call-${++sequence}`;
      calls.push({ ...input, id });
      return { id };
    },
    async createTask(input) {
      const id = `task-${++sequence}`;
      tasks.push({ ...input, id });
      return { id };
    },
  };
}

/** Connector wrapper so the in-memory CRM binds exactly like a provider. */
export function inMemoryCrmConnector(crm: CrmClient): Connector<Record<string, never>, CrmClient> {
  return {
    manifest: { id: "crm.memory", version: "0.1.0", capabilities: [...CRM_CAPABILITIES], requiredScopes: [] },
    async bind() { return crm; },
  };
}
