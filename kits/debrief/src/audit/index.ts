import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client, type InValue } from "@libsql/client";
import {
  HashChainedAuditStore,
  type AuditEventInput,
  type AuditPersistence,
  type AuditRecord,
} from "@kitstackco/sdk";

const CREATE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS audit_events (
    sequence INTEGER PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    timestamp TEXT NOT NULL,
    org_id TEXT NOT NULL,
    app_id TEXT,
    principal TEXT NOT NULL,
    actor TEXT NOT NULL,
    delegation TEXT,
    session_id TEXT,
    trace_id TEXT,
    parent_id TEXT,
    channel TEXT,
    kit_id TEXT,
    plugin_id TEXT,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    error_code TEXT,
    result_hash TEXT,
    attributes TEXT NOT NULL,
    previous_hash TEXT,
    hash TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS audit_events_org_idx ON audit_events (org_id, sequence);
  CREATE INDEX IF NOT EXISTS audit_events_session_idx ON audit_events (session_id, sequence);
`;

type Row = Record<string, unknown>;

export interface CreateAuditStoreOptions {
  readonly url?: string;
  readonly dbPath?: string;
  readonly client?: Client;
}

/** libSQL persistence for the SDK's content-free hash-chain implementation. */
class LibSqlAuditPersistence implements AuditPersistence {
  constructor(private readonly client: Client, private readonly initialized: Promise<void>) {}

  async append(record: AuditRecord): Promise<void> {
    await this.initialized;
    await this.client.execute({
      sql: `INSERT INTO audit_events (
        sequence, event_id, timestamp, org_id, app_id, principal, actor, delegation,
        session_id, trace_id, parent_id, channel, kit_id, plugin_id, action, outcome,
        error_code, result_hash, attributes, previous_hash, hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        record.sequence, record.eventId, record.timestamp, record.orgId, record.appId,
        record.principal, record.actor, record.delegation, record.sessionId, record.traceId,
        record.parentId, record.channel, record.kitId, record.pluginId, record.action,
        record.outcome, record.errorCode, record.resultHash, JSON.stringify(record.attributes),
        record.previousHash, record.hash,
      ] as InValue[],
    });
  }

  async list(): Promise<AuditRecord[]> {
    await this.initialized;
    const result = await this.client.execute("SELECT * FROM audit_events ORDER BY sequence ASC");
    return result.rows.map((row) => mapRecord(row as Row));
  }

}

export class DebriefAuditStore extends HashChainedAuditStore {
  private readonly client?: Client;
  private readonly ownsClient: boolean;
  private readonly initialized: Promise<void>;

  constructor(client: Client, ownsClient = false) {
    const initialized = client.executeMultiple(CREATE_SCHEMA_SQL);
    super({ persistence: new LibSqlAuditPersistence(client, initialized) });
    this.client = client;
    this.ownsClient = ownsClient;
    this.initialized = initialized;
  }

  override async append(input: AuditEventInput): Promise<AuditRecord> {
    await this.initialized;
    return super.append(input);
  }

  override async query(query = {}) {
    await this.initialized;
    return super.query(query);
  }

  override async verify() {
    await this.initialized;
    return super.verify();
  }

  override async export(...args: Parameters<HashChainedAuditStore["export"]>) {
    await this.initialized;
    return super.export(...args);
  }

  async close(): Promise<void> {
    await this.initialized;
    if (this.ownsClient) this.client?.close();
  }
}

export async function createAuditStore(options: CreateAuditStoreOptions = {}): Promise<DebriefAuditStore> {
  if (options.client && (options.url || options.dbPath)) {
    throw new Error("Provide either client or url/dbPath, not both");
  }
  if (options.client) return new DebriefAuditStore(options.client);

  const dbPath = options.dbPath ?? ".kitstack/demo.db";
  const url = options.url ?? `file:${dbPath}`;
  if (url.startsWith("file:")) {
    const path = url.slice("file:".length);
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  }
  return new DebriefAuditStore(createClient({ url }), true);
}

function mapRecord(row: Row): AuditRecord {
  let attributes: Record<string, string | number | boolean | null> = {};
  try {
    const parsed: unknown = JSON.parse(String(row.attributes));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      attributes = parsed as Record<string, string | number | boolean | null>;
    }
  } catch {
    // Verification will report the hash mismatch for malformed persisted data.
  }
  return {
    eventId: String(row.event_id),
    timestamp: String(row.timestamp),
    sequence: Number(row.sequence),
    orgId: String(row.org_id),
    appId: nullableString(row.app_id),
    principal: String(row.principal),
    actor: String(row.actor),
    delegation: nullableString(row.delegation),
    sessionId: nullableString(row.session_id),
    traceId: nullableString(row.trace_id),
    parentId: nullableString(row.parent_id),
    channel: nullableString(row.channel),
    kitId: nullableString(row.kit_id),
    pluginId: nullableString(row.plugin_id),
    action: String(row.action),
    outcome: String(row.outcome) as AuditRecord["outcome"],
    errorCode: nullableString(row.error_code),
    resultHash: nullableString(row.result_hash),
    attributes,
    previousHash: nullableString(row.previous_hash),
    hash: String(row.hash),
  };
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
