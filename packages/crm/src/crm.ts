/**
 * Provider-neutral CRM capability. Kits depend on this contract only; the
 * HubSpot connector (or any other provider) implements it behind a binding.
 */

export const CRM_CONNECTOR_KEY = "crm";

/** Capabilities a CRM connector declares; kits require the ones they use. */
export const CRM_CAPABILITIES = ["crm.account.read", "crm.activity.write", "crm.task.write"] as const;
export type CrmCapability = (typeof CRM_CAPABILITIES)[number];

export interface CrmCompany {
  id: string;
  name: string;
  domain?: string | null;
  city?: string | null;
  url?: string | null;
}

export interface CrmContact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  url?: string | null;
}

export interface CrmDeal {
  id: string;
  name: string;
  stage?: string | null;
  amount?: number | null;
  closeDate?: string | null;
  url?: string | null;
}

export interface CrmActivity {
  id: string;
  type: "call" | "note" | "task" | "meeting" | "email";
  timestamp: string | null;
  /** A short, single-line summary; never a transcript. */
  summary: string;
}

/** What a kit needs to know about an account before a conversation. */
export interface CrmAccountContext {
  company: CrmCompany | null;
  contacts: CrmContact[];
  deals: CrmDeal[];
  recentActivity: CrmActivity[];
}

/** The records an activity or task is attached to. */
export interface CrmRecordLinks {
  companyId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
}

export interface CrmCallLog extends CrmRecordLinks {
  title: string;
  /** Plain-text summary of the confirmed outcome. */
  summary: string;
  occurredAt: string;
  direction?: "inbound" | "outbound";
}

export interface CrmTaskInput extends CrmRecordLinks {
  title: string;
  notes?: string;
  dueAt: string;
}

export interface CrmRecordRef {
  id: string;
  url?: string | null;
}

export interface CrmClient {
  /** Provider name for telemetry and audit, e.g. "hubspot". */
  readonly provider: string;
  /** Resolve the company (and optionally contact) and load its CRM context. */
  findAccount(query: { company: string; contactName?: string }): Promise<CrmAccountContext>;
  /** Log a completed call or conversation on the linked records. */
  logCall(input: CrmCallLog): Promise<CrmRecordRef>;
  /** Create a follow-up task on the linked records. */
  createTask(input: CrmTaskInput): Promise<CrmRecordRef>;
}

export type CrmErrorCode = "auth" | "scope" | "not_found" | "rate_limited" | "invalid" | "unavailable";

/** Normalised provider error; messages carry no credentials or record content. */
export class CrmError extends Error {
  readonly code: CrmErrorCode;
  readonly status?: number;
  readonly retryAfterSeconds?: number;

  constructor(code: CrmErrorCode, message: string, options: { status?: number; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = "CrmError";
    this.code = code;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
