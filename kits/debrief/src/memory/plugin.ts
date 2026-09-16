import type { Client, InValue } from "@libsql/client";
import type { TelemetryStore } from "../plugins/telemetry/index.js";

export type MemoryStatus = "candidate" | "approved" | "published";

/**
 * The fields that may be learned by the demo are deliberately structured.
 * `correction` is operator-entered feedback, not a captured transcript.
 */
export interface MemoryWriteInput {
  correction: string;
  skill: string;
  context: Record<string, string>;
}

export interface MemoryRecord {
  memoryId: string;
  versionId: string;
  orgId: string;
  customerId: string | null;
  kitId: string;
  sessionId: string | null;
  correction: string;
  skill: string;
  context: Record<string, string>;
  status: MemoryStatus;
  createdAt: string;
  approvedAt: string | null;
  publishedAt: string | null;
}

/** Identity carried into every memory read/write event. */
export interface MemoryContext {
  orgId: string;
  appId: string | null;
  sessionId: string;
  traceId: string;
  parentId: string | null;
  kitId: string;
  customerId?: string | null;
}

export interface MemoryReadQuery {
  orgId: string;
  kitId: string;
  customerId?: string;
  sessionId?: string;
  /** Structured context keys that must match when supplied. */
  context?: Record<string, string>;
  limit?: number;
}

export interface CreateMemoryStoreOptions {
  client: Client;
  now?: () => string;
  createMemoryId?: () => string;
  createVersionId?: () => string;
  createEventId?: () => string;
}

type MemoryRow = Record<string, unknown>;

const CREATE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS demo_memories (
    memory_id TEXT NOT NULL,
    version_id TEXT NOT NULL UNIQUE,
    org_id TEXT NOT NULL,
    customer_id TEXT,
    kit_id TEXT NOT NULL,
    session_id TEXT,
    correction TEXT NOT NULL,
    skill TEXT NOT NULL,
    context_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('candidate', 'approved', 'published')),
    created_at TEXT NOT NULL,
    approved_at TEXT,
    published_at TEXT,
    PRIMARY KEY (memory_id, version_id)
  );
  CREATE INDEX IF NOT EXISTS demo_memories_retrieval_idx
    ON demo_memories (org_id, kit_id, status, created_at, memory_id, version_id);
  CREATE INDEX IF NOT EXISTS demo_memories_session_idx
    ON demo_memories (org_id, kit_id, session_id, status, created_at);
`;

/**
 * Structured, versioned memory for the unreleased sales-agent demo.
 *
 * Rows are append-only versions. Lifecycle changes update only status and
 * timestamps; a new correction always receives a new memory/version pair.
 * Candidate rows are never returned by readRelevant, making the run-1
 * approval boundary explicit: approved feedback is available to run 2.
 */
export class MemoryStore {
  private readonly initialized: Promise<void>;
  private readonly now: () => string;
  private readonly createMemoryId: () => string;
  private readonly createVersionId: () => string;
  private readonly createEventId: () => string;

  constructor(
    private readonly client: Client,
    private readonly telemetry: TelemetryStore,
    options: Omit<CreateMemoryStoreOptions, "client"> = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.createMemoryId = options.createMemoryId ?? (() => `memory-${crypto.randomUUID()}`);
    this.createVersionId = options.createVersionId ?? (() => `version-${crypto.randomUUID()}`);
    this.createEventId = options.createEventId ?? (() => `evt-${crypto.randomUUID()}`);
    this.initialized = client.executeMultiple(CREATE_SCHEMA_SQL).then(async () => {
      const columns = await client.execute("PRAGMA table_info(demo_memories)");
      const names = new Set(columns.rows.map((row) => String((row as MemoryRow).name)));
      if (!names.has("customer_id")) await client.execute("ALTER TABLE demo_memories ADD COLUMN customer_id TEXT");
      // Older production databases predate customer-scoped memory. Create the
      // index only after the compatibility column migration has completed.
      await client.execute(`CREATE INDEX IF NOT EXISTS demo_memories_customer_idx
        ON demo_memories (org_id, kit_id, customer_id, status, created_at)`);
    });
  }

  async writeCandidate(
    input: MemoryWriteInput,
    context: MemoryContext,
  ): Promise<MemoryRecord> {
    const memoryId = this.createMemoryId();
    const versionId = this.createVersionId();
    const createdAt = this.now();
    assertWriteInput(input);
    await this.initialized;
    await this.client.execute({
      sql: `
        INSERT INTO demo_memories (
          memory_id, version_id, org_id, customer_id, kit_id, session_id, correction,
          skill, context_json, status, created_at, approved_at, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate', ?, NULL, NULL)
      `,
      args: [
        memoryId,
        versionId,
        context.orgId,
        context.customerId ?? null,
        context.kitId,
        context.sessionId,
        input.correction,
        input.skill,
        encodeContext(input.context),
        createdAt,
      ] as InValue[],
    });
    await this.emitWrite("write_candidate", memoryId, context);
    return {
      memoryId,
      versionId,
      orgId: context.orgId,
      customerId: context.customerId ?? null,
      kitId: context.kitId,
      sessionId: context.sessionId,
      correction: input.correction,
      skill: input.skill,
      context: input.context,
      status: "candidate",
      createdAt,
      approvedAt: null,
      publishedAt: null,
    };
  }

  async approveCandidate(memoryId: string, context: MemoryContext): Promise<MemoryRecord> {
    return this.transition(memoryId, "approved", context);
  }

  async publishCandidate(memoryId: string, context: MemoryContext): Promise<MemoryRecord> {
    return this.transition(memoryId, "published", context);
  }

  /**
   * Read published or approved feedback in stable newest-first order.
   * This is the replay seam used by run 2 after run 1 teaches the workflow.
   */
  async readRelevant(query: MemoryReadQuery, context: MemoryContext): Promise<MemoryRecord[]> {
    if (query.orgId !== context.orgId || query.kitId !== context.kitId) {
      throw new Error("Memory query must match the event context organization and kit");
    }
    await this.initialized;
    const clauses = ["org_id = ?", "kit_id = ?", "status IN ('approved', 'published')"];
    const args: InValue[] = [query.orgId, query.kitId];
    if (query.customerId !== undefined) {
      clauses.push("customer_id = ?");
      args.push(query.customerId);
    }
    if (query.sessionId !== undefined) {
      clauses.push("session_id = ?");
      args.push(query.sessionId);
    }
    const limit = normalizeLimit(query.limit);
    const result = await this.client.execute({
      sql: `SELECT * FROM demo_memories WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC, memory_id ASC, version_id ASC LIMIT ${limit}`,
      args,
    });
    let records = result.rows.map((row) => mapMemory(row as MemoryRow));
    const expectedContext = query.context;
    if (expectedContext) {
      records = records.filter((record) => contextMatches(record.context, expectedContext));
    }
    await this.emitRead(records.map((record) => record.memoryId), context);
    return records;
  }

  /** Clear this org/kit's demo memory, preserving telemetry and app registrations. */
  async reset(context: MemoryContext): Promise<void> {
    await this.initialized;
    const existing = await this.client.execute({
      sql: "SELECT memory_id FROM demo_memories WHERE org_id = ? AND kit_id = ? ORDER BY created_at ASC, memory_id ASC, version_id ASC",
      args: [context.orgId, context.kitId],
    });
    const memoryIds = [...new Set(existing.rows.map((row) => String((row as MemoryRow).memory_id)))];
    await this.client.execute({
      sql: "DELETE FROM demo_memories WHERE org_id = ? AND kit_id = ?",
      args: [context.orgId, context.kitId],
    });
    await this.emitWrite("reset", memoryIds, context);
  }

  private async transition(
    memoryId: string,
    status: "approved" | "published",
    context: MemoryContext,
  ): Promise<MemoryRecord> {
    await this.initialized;
    const existing = await this.findOwned(memoryId, context);
    if (!existing) throw new Error(`Memory "${memoryId}" was not found for this organization and kit`);
    if (status === "approved" && existing.status !== "candidate") {
      throw new Error(`Memory "${memoryId}" is not a candidate`);
    }
    if (status === "published" && existing.status !== "approved") {
      throw new Error(`Memory "${memoryId}" must be approved before publishing`);
    }
    const timestamp = this.now();
    await this.client.execute({
      sql: status === "approved"
        ? "UPDATE demo_memories SET status = 'approved', approved_at = ? WHERE memory_id = ? AND org_id = ? AND kit_id = ?"
        : "UPDATE demo_memories SET status = 'published', published_at = ? WHERE memory_id = ? AND org_id = ? AND kit_id = ?",
      args: [timestamp, memoryId, context.orgId, context.kitId],
    });
    await this.emitWrite(status === "approved" ? "approve" : "publish", memoryId, context);
    const updated = await this.findOwned(memoryId, context);
    if (!updated) throw new Error(`Memory "${memoryId}" disappeared after transition`);
    return updated;
  }

  private async findOwned(memoryId: string, context: MemoryContext): Promise<MemoryRecord | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM demo_memories WHERE memory_id = ? AND org_id = ? AND kit_id = ? ORDER BY version_id ASC LIMIT 1",
      args: [memoryId, context.orgId, context.kitId],
    });
    return result.rows.length === 0 ? null : mapMemory(result.rows[0] as MemoryRow);
  }

  private async emitRead(memoryIds: string[], context: MemoryContext): Promise<void> {
    await this.telemetry.append({
      id: this.createEventId(),
      timestamp: this.now(),
      orgId: context.orgId,
      appId: context.appId,
      sessionId: context.sessionId,
      customerId: context.customerId ?? null,
      parentId: context.parentId,
      traceId: context.traceId,
      channel: "system",
      pluginId: "memory:default",
      kitId: context.kitId,
      type: "memory.read",
      operation: "read_relevant",
      outcome: "success",
      memoryIds,
    });
  }

  private async emitWrite(operation: string, memoryIds: string | string[], context: MemoryContext): Promise<void> {
    await this.telemetry.append({
      id: this.createEventId(),
      timestamp: this.now(),
      orgId: context.orgId,
      appId: context.appId,
      sessionId: context.sessionId,
      customerId: context.customerId ?? null,
      parentId: context.parentId,
      traceId: context.traceId,
      channel: "system",
      pluginId: "memory:default",
      kitId: context.kitId,
      type: "memory.write",
      operation,
      outcome: "success",
      memoryIds: typeof memoryIds === "string" ? [memoryIds] : memoryIds,
    });
  }
}

export function createMemoryStore(
  client: Client,
  telemetry: TelemetryStore,
  options: Omit<CreateMemoryStoreOptions, "client"> = {},
): MemoryStore {
  return new MemoryStore(client, telemetry, options);
}

function assertWriteInput(input: MemoryWriteInput): void {
  if (!input.correction.trim()) throw new Error("Memory correction must not be empty");
  if (!input.skill.trim()) throw new Error("Memory skill must not be empty");
  for (const [key, value] of Object.entries(input.context)) {
    if (!key.trim() || typeof value !== "string") {
      throw new Error("Memory context must contain non-empty string keys and values");
    }
  }
}

function encodeContext(context: Record<string, string>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(context).sort(([a], [b]) => a.localeCompare(b))));
}

function contextMatches(actual: Record<string, string>, expected: Record<string, string>): boolean {
  return Object.entries(expected).every(([key, value]) => actual[key] === value);
}

function mapMemory(row: MemoryRow): MemoryRecord {
  return {
    memoryId: stringValue(row.memory_id),
    versionId: stringValue(row.version_id),
    orgId: stringValue(row.org_id),
    kitId: stringValue(row.kit_id),
    sessionId: nullableString(row.session_id),
    customerId: nullableString(row.customer_id),
    correction: stringValue(row.correction),
    skill: stringValue(row.skill),
    context: decodeContext(row.context_json),
    status: stringValue(row.status) as MemoryStatus,
    createdAt: stringValue(row.created_at),
    approvedAt: nullableString(row.approved_at),
    publishedAt: nullableString(row.published_at),
  };
}

function decodeContext(value: unknown): Record<string, string> {
  const parsed: unknown = JSON.parse(String(value));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Stored memory context is invalid");
  }
  for (const [key, item] of Object.entries(parsed)) {
    if (typeof item !== "string") throw new Error(`Stored memory context value is invalid: ${key}`);
  }
  return parsed as Record<string, string>;
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 100;
  return Math.min(1000, Math.max(1, Math.floor(value)));
}

function stringValue(value: unknown): string {
  return String(value);
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
