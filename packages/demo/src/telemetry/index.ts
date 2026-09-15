import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client, type InValue, type ResultSet } from "@libsql/client";

/** The only event classes written by the demo runtime. */
export const TELEMETRY_EVENT_TYPES = [
  "app.registered",
  "app.token_issued",
  "mcp.tool_call",
  "plugin.registered",
  "plugin.invoked",
  "memory.read",
  "memory.write",
  "instruction.served",
  "voice.call",
  "inference",
  "session.completed",
] as const;

export type TelemetryEventType = (typeof TELEMETRY_EVENT_TYPES)[number];

export type TelemetryChannel = "mcp" | "proxy" | "voice" | "trigger" | "system" | "chat";
export type TelemetryOutcome = "success" | "error" | "started" | "partial";

/**
 * Metadata accepted by the store. Deliberately no prompt, completion, audio,
 * transcript, tool-argument, or tool-result fields exist in this contract.
 */
export interface TelemetryEventInput {
  id: string;
  timestamp: string;
  orgId: string;
  /** Boot events can happen before an app token exists. */
  appId: string | null;
  sessionId?: string | null;
  /** Allows session traces to render a parent-child tree. */
  parentId?: string | null;
  traceId?: string | null;
  channel: TelemetryChannel;
  pluginId?: string | null;
  kitId?: string | null;
  type: TelemetryEventType;
  operation: string;
  model?: string | null;
  provider?: string | null;
  callId?: string | null;
  requestTokens?: number | null;
  responseTokens?: number | null;
  latencyMs?: number | null;
  estimatedCostUsd?: number | null;
  outcome: TelemetryOutcome;
  instructionVersions?: readonly string[];
  memoryIds?: readonly string[];
}

export interface TelemetryEvent extends TelemetryEventInput {
  /** Monotonic insertion order; used instead of timestamps for stable traces. */
  sequence: number;
}

export interface TelemetryQuery {
  orgId?: string;
  /** `null` explicitly queries boot events without an app token. */
  appId?: string | null;
  sessionId?: string;
  traceId?: string;
  parentId?: string | null;
  type?: TelemetryEventType;
  channel?: TelemetryChannel;
  from?: string;
  to?: string;
  limit?: number;
}

export interface TelemetryAggregateDimension {
  key: string | null;
  eventCount: number;
  requestTokens: number;
  responseTokens: number;
  estimatedCostUsd: number;
}

export interface TelemetryAggregate {
  totalEvents: number;
  totalRequestTokens: number;
  totalResponseTokens: number;
  totalEstimatedCostUsd: number;
  totalLatencyMs: number;
  successCount: number;
  errorCount: number;
  byApp: TelemetryAggregateDimension[];
  byType: TelemetryAggregateDimension[];
  byChannel: TelemetryAggregateDimension[];
}

export interface CreateTelemetryStoreOptions {
  /** A libSQL URL, normally `:memory:` in tests or `file:.kitstack/demo.db`. */
  url?: string;
  /** Convenience path for a local demo database. Never points at databases/local.db by default. */
  dbPath?: string;
  /** Injected client is useful for callers that own the connection lifecycle. */
  client?: Client;
}

export const DEFAULT_DEMO_DB_PATH = ".kitstack/demo.db";

const CREATE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS telemetry_events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    timestamp TEXT NOT NULL,
    org_id TEXT NOT NULL,
    app_id TEXT,
    session_id TEXT,
    parent_id TEXT,
    trace_id TEXT,
    channel TEXT NOT NULL,
    plugin_id TEXT,
    kit_id TEXT,
    type TEXT NOT NULL,
    operation TEXT NOT NULL,
    model TEXT,
    provider TEXT,
    call_id TEXT,
    request_tokens INTEGER,
    response_tokens INTEGER,
    latency_ms INTEGER,
    estimated_cost_usd REAL,
    outcome TEXT NOT NULL,
    instruction_versions TEXT,
    memory_ids TEXT
  );
  CREATE INDEX IF NOT EXISTS telemetry_events_org_idx
    ON telemetry_events (org_id, sequence);
  CREATE INDEX IF NOT EXISTS telemetry_events_app_idx
    ON telemetry_events (app_id, sequence);
  CREATE INDEX IF NOT EXISTS telemetry_events_session_idx
    ON telemetry_events (session_id, sequence);
  CREATE INDEX IF NOT EXISTS telemetry_events_parent_idx
    ON telemetry_events (parent_id, sequence);
`;

type Row = Record<string, unknown>;

/**
 * Persistent metadata-only telemetry storage for the unreleased demo runtime.
 * It owns only `telemetry_events`; memory, sessions, and app registries can
 * share the database later without coupling those contracts here.
 */
export class TelemetryStore {
  private readonly initialized: Promise<void>;
  private readonly ownsClient: boolean;

  constructor(private readonly client: Client, ownsClient = false) {
    this.ownsClient = ownsClient;
    this.initialized = client.executeMultiple(CREATE_SCHEMA_SQL).then(async () => {
      const columns = await client.execute("PRAGMA table_info(telemetry_events)");
      const names = new Set(columns.rows.map((row) => String((row as Row).name)));
      if (!names.has("provider")) await client.execute("ALTER TABLE telemetry_events ADD COLUMN provider TEXT");
      if (!names.has("call_id")) await client.execute("ALTER TABLE telemetry_events ADD COLUMN call_id TEXT");
    });
  }

  async append(input: TelemetryEventInput): Promise<TelemetryEvent> {
    await this.initialized;

    // Insert each field explicitly. This is the retention boundary: unknown
    // runtime properties can never become persisted event data.
    await this.client.execute({
      sql: `
        INSERT INTO telemetry_events (
          id, timestamp, org_id, app_id, session_id, parent_id, trace_id,
          channel, plugin_id, kit_id, type, operation, model, provider, call_id,
          request_tokens, response_tokens, latency_ms, estimated_cost_usd,
          outcome, instruction_versions, memory_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        input.id,
        input.timestamp,
        input.orgId,
        input.appId,
        input.sessionId ?? null,
        input.parentId ?? null,
        input.traceId ?? null,
        input.channel,
        input.pluginId ?? null,
        input.kitId ?? null,
        input.type,
        input.operation,
        input.model ?? null,
        input.provider ?? null,
        input.callId ?? null,
        input.requestTokens ?? null,
        input.responseTokens ?? null,
        input.latencyMs ?? null,
        input.estimatedCostUsd ?? null,
        input.outcome,
        encodeStringArray(input.instructionVersions),
        encodeStringArray(input.memoryIds),
      ] as InValue[],
    });

    const rows = await this.client.execute({
      sql: "SELECT * FROM telemetry_events WHERE id = ? LIMIT 1",
      args: [input.id],
    });
    if (rows.rows.length !== 1) {
      throw new Error(`Telemetry event was not readable after append: ${input.id}`);
    }
    return mapEvent(rows.rows[0] as Row);
  }

  /** Query results are always returned in insertion order for stable trees. */
  async query(query: TelemetryQuery = {}): Promise<TelemetryEvent[]> {
    await this.initialized;
    const { where, args } = buildWhere(query);
    const limit = normalizeLimit(query.limit);
    const result = await this.client.execute({
      sql: `SELECT * FROM telemetry_events ${where} ORDER BY sequence ASC LIMIT ${limit}`,
      args,
    });
    return result.rows.map((row) => mapEvent(row as Row));
  }

  async aggregate(query: TelemetryQuery = {}): Promise<TelemetryAggregate> {
    await this.initialized;
    const { where, args } = buildWhere(query);
    const [totals, byApp, byType, byChannel] = await Promise.all([
      this.client.execute({
        sql: `
          SELECT
            COUNT(*) AS total_events,
            COALESCE(SUM(request_tokens), 0) AS total_request_tokens,
            COALESCE(SUM(response_tokens), 0) AS total_response_tokens,
            COALESCE(SUM(estimated_cost_usd), 0) AS total_estimated_cost_usd,
            COALESCE(SUM(latency_ms), 0) AS total_latency_ms,
            COALESCE(SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END), 0) AS success_count,
            COALESCE(SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END), 0) AS error_count
          FROM telemetry_events ${where}
        `,
        args,
      }),
      this.groupedAggregate("app_id", where, args),
      this.groupedAggregate("type", where, args),
      this.groupedAggregate("channel", where, args),
    ]);

    const row = totals.rows[0] as Row;
    return {
      totalEvents: numberValue(row.total_events),
      totalRequestTokens: numberValue(row.total_request_tokens),
      totalResponseTokens: numberValue(row.total_response_tokens),
      totalEstimatedCostUsd: numberValue(row.total_estimated_cost_usd),
      totalLatencyMs: numberValue(row.total_latency_ms),
      successCount: numberValue(row.success_count),
      errorCount: numberValue(row.error_count),
      byApp: mapDimensions(byApp),
      byType: mapDimensions(byType),
      byChannel: mapDimensions(byChannel),
    };
  }

  /** Clear this store's metadata while leaving other demo tables untouched. */
  async reset(): Promise<void> {
    await this.initialized;
    await this.client.execute("DELETE FROM telemetry_events");
  }

  async close(): Promise<void> {
    await this.initialized;
    if (this.ownsClient) {
      this.client.close();
    }
  }

  private async groupedAggregate(
    column: "app_id" | "type" | "channel",
    where: string,
    args: InValue[],
  ): Promise<ResultSet> {
    return this.client.execute({
      sql: `
        SELECT
          ${column} AS dimension_key,
          COUNT(*) AS event_count,
          COALESCE(SUM(request_tokens), 0) AS request_tokens,
          COALESCE(SUM(response_tokens), 0) AS response_tokens,
          COALESCE(SUM(estimated_cost_usd), 0) AS estimated_cost_usd
        FROM telemetry_events ${where}
        GROUP BY ${column}
        ORDER BY ${column} IS NOT NULL ASC, ${column} ASC
      `,
      args,
    });
  }
}

export async function createTelemetryStore(
  options: CreateTelemetryStoreOptions = {},
): Promise<TelemetryStore> {
  if (options.client && (options.url || options.dbPath)) {
    throw new Error("Provide either client or url/dbPath, not both");
  }

  if (options.client) {
    return new TelemetryStore(options.client);
  }

  const dbPath = options.dbPath ?? DEFAULT_DEMO_DB_PATH;
  if (dbPath === "databases/local.db" || dbPath.endsWith("/databases/local.db")) {
    throw new Error("The demo telemetry store must not reuse databases/local.db");
  }
  const url = options.url ?? `file:${dbPath}`;
  if (url.startsWith("file:")) {
    const path = url.slice("file:".length);
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }
  }
  return new TelemetryStore(createClient({ url }), true);
}

function buildWhere(query: TelemetryQuery): { where: string; args: InValue[] } {
  const clauses: string[] = [];
  const args: InValue[] = [];
  if (query.orgId !== undefined) {
    clauses.push("org_id = ?");
    args.push(query.orgId);
  }
  if (query.appId !== undefined) {
    clauses.push(query.appId === null ? "app_id IS NULL" : "app_id = ?");
    if (query.appId !== null) args.push(query.appId);
  }
  if (query.sessionId !== undefined) {
    clauses.push("session_id = ?");
    args.push(query.sessionId);
  }
  if (query.traceId !== undefined) {
    clauses.push("trace_id = ?");
    args.push(query.traceId);
  }
  if (query.parentId !== undefined) {
    clauses.push(query.parentId === null ? "parent_id IS NULL" : "parent_id = ?");
    if (query.parentId !== null) args.push(query.parentId);
  }
  if (query.type !== undefined) {
    clauses.push("type = ?");
    args.push(query.type);
  }
  if (query.channel !== undefined) {
    clauses.push("channel = ?");
    args.push(query.channel);
  }
  if (query.from !== undefined) {
    clauses.push("timestamp >= ?");
    args.push(query.from);
  }
  if (query.to !== undefined) {
    clauses.push("timestamp < ?");
    args.push(query.to);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", args };
}

function mapEvent(row: Row): TelemetryEvent {
  return {
    id: stringValue(row.id),
    timestamp: stringValue(row.timestamp),
    orgId: stringValue(row.org_id),
    appId: nullableString(row.app_id),
    sessionId: nullableString(row.session_id),
    parentId: nullableString(row.parent_id),
    traceId: nullableString(row.trace_id),
    channel: stringValue(row.channel) as TelemetryChannel,
    pluginId: nullableString(row.plugin_id),
    kitId: nullableString(row.kit_id),
    type: stringValue(row.type) as TelemetryEventType,
    operation: stringValue(row.operation),
    model: nullableString(row.model),
    provider: nullableString(row.provider),
    callId: nullableString(row.call_id),
    requestTokens: nullableNumber(row.request_tokens),
    responseTokens: nullableNumber(row.response_tokens),
    latencyMs: nullableNumber(row.latency_ms),
    estimatedCostUsd: nullableNumber(row.estimated_cost_usd),
    outcome: stringValue(row.outcome) as TelemetryOutcome,
    instructionVersions: decodeStringArray(row.instruction_versions),
    memoryIds: decodeStringArray(row.memory_ids),
    sequence: numberValue(row.sequence),
  };
}

function mapDimensions(result: ResultSet): TelemetryAggregateDimension[] {
  return result.rows.map((row) => {
    const value = row as Row;
    return {
      key: nullableString(value.dimension_key),
      eventCount: numberValue(value.event_count),
      requestTokens: numberValue(value.request_tokens),
      responseTokens: numberValue(value.response_tokens),
      estimatedCostUsd: numberValue(value.estimated_cost_usd),
    };
  });
}

function encodeStringArray(value: readonly string[] | undefined): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

function decodeStringArray(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  try {
    const decoded: unknown = JSON.parse(String(value));
    return Array.isArray(decoded) && decoded.every((item) => typeof item === "string")
      ? decoded
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined) return 1000;
  if (!Number.isFinite(value)) return 1000;
  return Math.min(10000, Math.max(1, Math.floor(value)));
}

function stringValue(value: unknown): string {
  return String(value);
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function numberValue(value: unknown): number {
  return Number(value ?? 0);
}
