import type { Client, InValue } from "@libsql/client";
import type { DebriefSession, DebriefState } from "./index.js";

export type CustomerEventType =
  | "prebrief"
  | "call_completed"
  | "note"
  | "address_discovered"
  | "debrief_confirmed";

export interface CustomerIdentityInput {
  company: string;
  contactName: string;
  location: string;
}

export interface DebriefPersistenceScope {
  sessionId?: string;
  traceId?: string;
}

export interface CustomerRecord extends CustomerIdentityInput {
  customerId: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerEventRecord {
  eventId: string;
  orgId: string;
  customerId: string;
  sessionId: string;
  kitId: string;
  type: CustomerEventType;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export type DebriefDraftStatus = "draft" | "confirmed" | "partial";

export interface DebriefDraftRecord {
  draftId: string;
  orgId: string;
  customerId: string | null;
  sessionId: string;
  kitId: string;
  status: DebriefDraftStatus;
  fields: Record<string, unknown>;
  updatedAt: string;
}

export interface DebriefPersistence {
  loadSessions(orgId: string, kitId: string): Promise<DebriefSession[]>;
  saveSession(session: DebriefSession): Promise<void>;
  upsertCustomer(orgId: string, identity: CustomerIdentityInput, scope?: DebriefPersistenceScope): Promise<CustomerRecord>;
  getCustomer(orgId: string, customerId: string): Promise<CustomerRecord | null>;
  listCustomerEvents(orgId: string, customerId: string, kitId?: string): Promise<CustomerEventRecord[]>;
  appendCustomerEvent(event: CustomerEventRecord): Promise<void>;
  getDraft(orgId: string, sessionId: string): Promise<DebriefDraftRecord | null>;
  saveDraft(draft: DebriefDraftRecord): Promise<void>;
  reset(orgId: string, kitId: string): Promise<void>;
}

export interface CreateDebriefPersistenceOptions {
  now?: () => string;
  createCustomerId?: () => string;
}

const CREATE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS demo_customers (
    customer_id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    identity_key TEXT NOT NULL,
    company TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    location TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (org_id, identity_key)
  );
  CREATE INDEX IF NOT EXISTS demo_customers_org_idx
    ON demo_customers (org_id, updated_at, customer_id);

  CREATE TABLE IF NOT EXISTS demo_customer_events (
    event_id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    kit_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('prebrief', 'call_completed', 'note', 'address_discovered', 'debrief_confirmed')),
    occurred_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS demo_customer_events_customer_idx
    ON demo_customer_events (org_id, customer_id, kit_id, occurred_at, event_id);
  CREATE INDEX IF NOT EXISTS demo_customer_events_session_idx
    ON demo_customer_events (org_id, session_id, occurred_at, event_id);

  CREATE TABLE IF NOT EXISTS demo_debrief_sessions (
    session_id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    kit_id TEXT NOT NULL,
    customer_id TEXT,
    state TEXT NOT NULL,
    goal TEXT NOT NULL,
    callback_at TEXT,
    scheduled_call_at TEXT,
    callback_timezone TEXT,
    call_id TEXT,
    instruction_version TEXT NOT NULL,
    memory_ids_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    error TEXT
  );
  CREATE INDEX IF NOT EXISTS demo_debrief_sessions_scope_idx
    ON demo_debrief_sessions (org_id, kit_id, updated_at, session_id);
  CREATE INDEX IF NOT EXISTS demo_debrief_sessions_customer_idx
    ON demo_debrief_sessions (org_id, customer_id, updated_at, session_id);

  CREATE TABLE IF NOT EXISTS demo_debrief_drafts (
    draft_id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    customer_id TEXT,
    session_id TEXT NOT NULL UNIQUE,
    kit_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'partial')),
    fields_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS demo_debrief_drafts_customer_idx
    ON demo_debrief_drafts (org_id, customer_id, updated_at, draft_id);
`;

type Row = Record<string, unknown>;

export class LibsqlDebriefPersistence implements DebriefPersistence {
  private readonly initialized: Promise<void>;
  private readonly now: () => string;
  private readonly createCustomerId: () => string;

  constructor(
    private readonly client: Client,
    options: CreateDebriefPersistenceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.createCustomerId = options.createCustomerId ?? (() => `customer-${crypto.randomUUID()}`);
    this.initialized = client.executeMultiple(CREATE_SCHEMA_SQL).then(() => undefined);
  }

  async loadSessions(orgId: string, kitId: string): Promise<DebriefSession[]> {
    await this.initialized;
    const result = await this.client.execute({
      sql: `SELECT * FROM demo_debrief_sessions
        WHERE org_id = ? AND kit_id = ? ORDER BY created_at ASC, session_id ASC`,
      args: [orgId, kitId],
    });
    return result.rows.map((row) => mapSession(row as Row));
  }

  async saveSession(session: DebriefSession): Promise<void> {
    await this.initialized;
    await this.client.execute({
      sql: `INSERT INTO demo_debrief_sessions (
        session_id, org_id, kit_id, customer_id, state, goal, callback_at,
        scheduled_call_at, callback_timezone, call_id, instruction_version,
        memory_ids_json, created_at, updated_at, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        customer_id = excluded.customer_id,
        state = excluded.state,
        goal = excluded.goal,
        callback_at = excluded.callback_at,
        scheduled_call_at = excluded.scheduled_call_at,
        callback_timezone = excluded.callback_timezone,
        call_id = excluded.call_id,
        instruction_version = excluded.instruction_version,
        memory_ids_json = excluded.memory_ids_json,
        updated_at = excluded.updated_at,
        error = excluded.error`,
      args: [
        session.sessionId,
        session.orgId,
        session.kitId,
        session.customerId,
        session.state,
        session.goal,
        session.callbackAt,
        session.scheduledCallAt,
        session.callbackTimezone,
        session.callId,
        session.instructionVersion,
        JSON.stringify(session.memoryIds),
        session.createdAt,
        session.updatedAt,
        session.error ?? null,
      ] as InValue[],
    });
  }

  async upsertCustomer(orgId: string, identity: CustomerIdentityInput, _scope?: DebriefPersistenceScope): Promise<CustomerRecord> {
    await this.initialized;
    const normalized = normalizeCustomer(identity);
    const identityKey = customerIdentityKey(normalized);
    const existing = await this.client.execute({
      sql: "SELECT * FROM demo_customers WHERE org_id = ? AND identity_key = ? LIMIT 1",
      args: [orgId, identityKey],
    });
    const timestamp = this.now();
    let customerId: string;
    if (existing.rows.length) {
      customerId = String((existing.rows[0] as Row).customer_id);
      await this.client.execute({
        sql: `UPDATE demo_customers SET company = ?, contact_name = ?, location = ?, updated_at = ?
          WHERE org_id = ? AND customer_id = ?`,
        args: [normalized.company, normalized.contactName, normalized.location, timestamp, orgId, customerId],
      });
    } else {
      customerId = this.createCustomerId();
      await this.client.execute({
        sql: `INSERT INTO demo_customers
          (customer_id, org_id, identity_key, company, contact_name, location, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [customerId, orgId, identityKey, normalized.company, normalized.contactName, normalized.location, timestamp, timestamp],
      });
    }
    const customer = await this.getCustomer(orgId, customerId);
    if (!customer) throw new Error(`Customer "${customerId}" was not readable after upsert`);
    return customer;
  }

  async getCustomer(orgId: string, customerId: string): Promise<CustomerRecord | null> {
    await this.initialized;
    const result = await this.client.execute({
      sql: "SELECT * FROM demo_customers WHERE org_id = ? AND customer_id = ? LIMIT 1",
      args: [orgId, customerId],
    });
    return result.rows.length ? mapCustomer(result.rows[0] as Row) : null;
  }

  async listCustomerEvents(orgId: string, customerId: string, kitId?: string): Promise<CustomerEventRecord[]> {
    await this.initialized;
    const args: InValue[] = [orgId, customerId];
    const kitClause = kitId === undefined ? "" : " AND kit_id = ?";
    if (kitId !== undefined) args.push(kitId);
    const result = await this.client.execute({
      sql: `SELECT * FROM demo_customer_events
        WHERE org_id = ? AND customer_id = ?${kitClause}
        ORDER BY occurred_at ASC, event_id ASC`,
      args,
    });
    return result.rows.map((row) => mapEvent(row as Row));
  }

  async appendCustomerEvent(event: CustomerEventRecord): Promise<void> {
    await this.initialized;
    await this.client.execute({
      sql: `INSERT INTO demo_customer_events
        (event_id, org_id, customer_id, session_id, kit_id, type, occurred_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id) DO NOTHING`,
      args: [
        event.eventId,
        event.orgId,
        event.customerId,
        event.sessionId,
        event.kitId,
        event.type,
        event.occurredAt,
        JSON.stringify(event.payload),
      ] as InValue[],
    });
  }

  async getDraft(orgId: string, sessionId: string): Promise<DebriefDraftRecord | null> {
    await this.initialized;
    const result = await this.client.execute({
      sql: "SELECT * FROM demo_debrief_drafts WHERE org_id = ? AND session_id = ? LIMIT 1",
      args: [orgId, sessionId],
    });
    return result.rows.length ? mapDraft(result.rows[0] as Row) : null;
  }

  async saveDraft(draft: DebriefDraftRecord): Promise<void> {
    await this.initialized;
    await this.client.execute({
      sql: `INSERT INTO demo_debrief_drafts
        (draft_id, org_id, customer_id, session_id, kit_id, status, fields_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          draft_id = excluded.draft_id,
          customer_id = excluded.customer_id,
          kit_id = excluded.kit_id,
          status = excluded.status,
          fields_json = excluded.fields_json,
          updated_at = excluded.updated_at`,
      args: [draft.draftId, draft.orgId, draft.customerId, draft.sessionId, draft.kitId, draft.status, JSON.stringify(draft.fields), draft.updatedAt],
    });
  }

  async reset(orgId: string, kitId: string): Promise<void> {
    await this.initialized;
    // The demo owns these tables for one org. Delete dependent rows first so
    // this remains safe if foreign keys are enabled by a future host.
    await this.client.execute({ sql: "DELETE FROM demo_debrief_drafts WHERE org_id = ? AND kit_id = ?", args: [orgId, kitId] });
    await this.client.execute({ sql: "DELETE FROM demo_customer_events WHERE org_id = ? AND kit_id = ?", args: [orgId, kitId] });
    await this.client.execute({ sql: "DELETE FROM demo_debrief_sessions WHERE org_id = ? AND kit_id = ?", args: [orgId, kitId] });
    await this.client.execute({ sql: "DELETE FROM demo_customers WHERE org_id = ?", args: [orgId] });
  }
}

export function createDebriefPersistence(
  client: Client,
  options: CreateDebriefPersistenceOptions = {},
): LibsqlDebriefPersistence {
  return new LibsqlDebriefPersistence(client, options);
}

export function normalizeCustomer(identity: CustomerIdentityInput): CustomerIdentityInput {
  const company = normalizeField(identity.company);
  const contactName = normalizeField(identity.contactName);
  const location = normalizeField(identity.location);
  if (!company) throw new Error("Customer company must not be empty");
  if (!contactName) throw new Error("Customer contact name must not be empty");
  if (!location) throw new Error("Customer location must not be empty");
  return { company, contactName, location };
}

export function customerIdentityKey(identity: CustomerIdentityInput): string {
  return [identity.company, identity.contactName]
    .map((value) => value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim())
    .join("|");
}

function mapSession(row: Row): DebriefSession {
  return {
    sessionId: String(row.session_id),
    orgId: String(row.org_id),
    kitId: String(row.kit_id),
    customerId: nullableString(row.customer_id),
    state: String(row.state) as DebriefState,
    goal: String(row.goal),
    callbackAt: nullableString(row.callback_at),
    scheduledCallAt: nullableString(row.scheduled_call_at),
    callbackTimezone: nullableString(row.callback_timezone),
    callId: nullableString(row.call_id),
    instructionVersion: String(row.instruction_version),
    memoryIds: decodeStringArray(row.memory_ids_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(row.error === null || row.error === undefined ? {} : { error: String(row.error) }),
  };
}

function mapCustomer(row: Row): CustomerRecord {
  return {
    customerId: String(row.customer_id),
    orgId: String(row.org_id),
    company: String(row.company),
    contactName: String(row.contact_name),
    location: String(row.location),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapEvent(row: Row): CustomerEventRecord {
  return {
    eventId: String(row.event_id),
    orgId: String(row.org_id),
    customerId: String(row.customer_id),
    sessionId: String(row.session_id),
    kitId: String(row.kit_id),
    type: String(row.type) as CustomerEventType,
    occurredAt: String(row.occurred_at),
    payload: decodeObject(row.payload_json),
  };
}

function mapDraft(row: Row): DebriefDraftRecord {
  return {
    draftId: String(row.draft_id),
    orgId: String(row.org_id),
    customerId: nullableString(row.customer_id),
    sessionId: String(row.session_id),
    kitId: String(row.kit_id),
    status: String(row.status) as DebriefDraftStatus,
    fields: decodeObject(row.fields_json),
    updatedAt: String(row.updated_at),
  };
}

function normalizeField(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function decodeStringArray(value: unknown): string[] {
  const parsed: unknown = JSON.parse(String(value));
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error("Stored debrief memory references are invalid");
  }
  return parsed;
}

function decodeObject(value: unknown): Record<string, unknown> {
  const parsed: unknown = JSON.parse(String(value));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Stored structured payload is invalid");
  }
  return parsed as Record<string, unknown>;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
