import type { Client, InValue } from "@libsql/client";

export type ScheduledCallStatus = "scheduled" | "starting" | "started" | "failed";

export interface ScheduledCallRecord {
  scheduledCallId: string;
  orgId: string;
  sessionId: string;
  scheduledAt: string;
  status: ScheduledCallStatus;
  attemptCount: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  providerCallId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleCallInput {
  orgId: string;
  sessionId: string;
  scheduledAt: string;
  scheduledCallId?: string;
}

export interface ClaimDueInput {
  orgId: string;
  now: string;
  workerId: string;
  leaseMs?: number;
}

export interface CompleteCallInput {
  orgId: string;
  scheduledCallId: string;
  workerId: string;
  providerCallId: string | null;
  now: string;
}

export interface FailCallInput {
  orgId: string;
  scheduledCallId: string;
  workerId: string;
  reason: string;
  now: string;
}

export interface ScheduledCallOperations {
  schedule(input: ScheduleCallInput): Promise<ScheduledCallRecord>;
  claimDue(input: ClaimDueInput): Promise<ScheduledCallRecord | null>;
  complete(input: CompleteCallInput): Promise<ScheduledCallRecord>;
  fail(input: FailCallInput): Promise<ScheduledCallRecord>;
  get(orgId: string, scheduledCallId: string): Promise<ScheduledCallRecord | null>;
  list(orgId: string): Promise<ScheduledCallRecord[]>;
  reset(orgId: string): Promise<void>;
}

export interface CreateScheduledCallStoreOptions {
  now?: () => string;
  createScheduledCallId?: () => string;
}

const CREATE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS scheduled_calls (
    scheduled_call_id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'starting', 'started', 'failed')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    lease_owner TEXT,
    lease_expires_at TEXT,
    provider_call_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS scheduled_calls_due_idx
    ON scheduled_calls (org_id, status, scheduled_at, scheduled_call_id);
  CREATE INDEX IF NOT EXISTS scheduled_calls_lease_idx
    ON scheduled_calls (org_id, status, lease_expires_at, scheduled_call_id);
  CREATE INDEX IF NOT EXISTS scheduled_calls_session_idx
    ON scheduled_calls (org_id, session_id);
`;

type Row = Record<string, unknown>;

/** Durable scheduled-call state. Claiming is one write transaction. */
export class LibsqlScheduledCallStore implements ScheduledCallOperations {
  private readonly initialized: Promise<void>;
  private readonly now: () => string;
  private readonly createScheduledCallId: () => string;

  constructor(
    private readonly client: Client,
    options: CreateScheduledCallStoreOptions = {},
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.createScheduledCallId = options.createScheduledCallId ?? (() => `scheduled-${crypto.randomUUID()}`);
    this.initialized = client.executeMultiple(CREATE_SCHEMA_SQL).then(() => undefined);
  }

  async schedule(input: ScheduleCallInput): Promise<ScheduledCallRecord> {
    assertNonEmpty(input.orgId, "orgId");
    assertNonEmpty(input.sessionId, "sessionId");
    assertTimestamp(input.scheduledAt);
    await this.initialized;
    const timestamp = this.now();
    await this.client.execute({
      sql: `INSERT INTO scheduled_calls
        (scheduled_call_id, org_id, session_id, scheduled_at, status, attempt_count,
         lease_owner, lease_expires_at, provider_call_id, error, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'scheduled', 0, NULL, NULL, NULL, NULL, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          scheduled_at = excluded.scheduled_at,
          updated_at = excluded.updated_at
        WHERE scheduled_calls.status = 'scheduled'`,
      args: [input.scheduledCallId ?? this.createScheduledCallId(), input.orgId, input.sessionId, input.scheduledAt, timestamp, timestamp] as InValue[],
    });
    const record = await this.findBySession(input.orgId, input.sessionId);
    if (!record) throw new Error(`Scheduled call for session "${input.sessionId}" was not readable after schedule`);
    return record;
  }

  async claimDue(input: ClaimDueInput): Promise<ScheduledCallRecord | null> {
    assertNonEmpty(input.orgId, "orgId");
    assertNonEmpty(input.workerId, "workerId");
    assertTimestamp(input.now);
    const leaseMs = input.leaseMs ?? 30_000;
    if (!Number.isInteger(leaseMs) || leaseMs <= 0) throw new Error("leaseMs must be a positive integer");
    await this.initialized;
    const leaseExpiresAt = new Date(Date.parse(input.now) + leaseMs).toISOString();
    // A process restart must not retry an uncertain provider call. Surface it
    // as an operator-visible failure before considering new scheduled work.
    await this.client.execute({
      sql: `UPDATE scheduled_calls
        SET status = 'failed', error = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
        WHERE org_id = ? AND status = 'starting' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?`,
      args: ["Lease expired while starting call; operator action required", input.now, input.orgId, input.now] as InValue[],
    });
    // The subquery and update are one SQLite write statement. This keeps the
    // claim idempotent when two tasks poll at the same time and works with
    // libSQL's in-memory client, whose transaction connection is separate.
    const result = await this.client.execute({
      sql: `UPDATE scheduled_calls SET status = 'starting', attempt_count = attempt_count + 1,
        lease_owner = ?, lease_expires_at = ?, updated_at = ?
        WHERE org_id = ? AND status = 'scheduled' AND scheduled_call_id = (
          SELECT scheduled_call_id FROM scheduled_calls
          WHERE org_id = ? AND status = 'scheduled' AND scheduled_at <= ?
          ORDER BY scheduled_at ASC, scheduled_call_id ASC LIMIT 1
        ) RETURNING *`,
      args: [input.workerId, leaseExpiresAt, input.now, input.orgId, input.orgId, input.now] as InValue[],
    });
    return result.rows.length ? mapScheduledCall(result.rows[0] as Row) : null;
  }

  async complete(input: CompleteCallInput): Promise<ScheduledCallRecord> {
    await this.initialized;
    const result = await this.client.execute({
      sql: `UPDATE scheduled_calls SET status = 'started', provider_call_id = ?,
        lease_owner = NULL, lease_expires_at = NULL, updated_at = ?, error = NULL
        WHERE org_id = ? AND scheduled_call_id = ? AND status = 'starting'
          AND lease_owner = ? AND (lease_expires_at IS NULL OR lease_expires_at > ?)`,
      args: [input.providerCallId, input.now, input.orgId, input.scheduledCallId, input.workerId, input.now] as InValue[],
    });
    if (Number(result.rowsAffected) !== 1) {
      throw new Error(`Scheduled call "${input.scheduledCallId}" is no longer owned by worker "${input.workerId}"`);
    }
    const record = await this.get(input.orgId, input.scheduledCallId);
    if (!record) throw new Error(`Scheduled call "${input.scheduledCallId}" disappeared after start`);
    return record;
  }

  async fail(input: FailCallInput): Promise<ScheduledCallRecord> {
    assertNonEmpty(input.reason, "reason");
    await this.initialized;
    const result = await this.client.execute({
      sql: `UPDATE scheduled_calls SET status = 'failed', error = ?,
        lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
        WHERE org_id = ? AND scheduled_call_id = ? AND status = 'starting' AND lease_owner = ?`,
      args: [input.reason, input.now, input.orgId, input.scheduledCallId, input.workerId] as InValue[],
    });
    if (Number(result.rowsAffected) !== 1) {
      throw new Error(`Scheduled call "${input.scheduledCallId}" is no longer owned by worker "${input.workerId}"`);
    }
    const record = await this.get(input.orgId, input.scheduledCallId);
    if (!record) throw new Error(`Scheduled call "${input.scheduledCallId}" disappeared after failure`);
    return record;
  }

  async get(orgId: string, scheduledCallId: string): Promise<ScheduledCallRecord | null> {
    await this.initialized;
    const result = await this.client.execute({
      sql: "SELECT * FROM scheduled_calls WHERE org_id = ? AND scheduled_call_id = ? LIMIT 1",
      args: [orgId, scheduledCallId],
    });
    return result.rows.length ? mapScheduledCall(result.rows[0] as Row) : null;
  }

  async list(orgId: string): Promise<ScheduledCallRecord[]> {
    await this.initialized;
    const result = await this.client.execute({
      sql: "SELECT * FROM scheduled_calls WHERE org_id = ? ORDER BY scheduled_at ASC, scheduled_call_id ASC",
      args: [orgId],
    });
    return result.rows.map((row) => mapScheduledCall(row as Row));
  }

  async reset(orgId: string): Promise<void> {
    await this.initialized;
    await this.client.execute({ sql: "DELETE FROM scheduled_calls WHERE org_id = ?", args: [orgId] });
  }

  private async findBySession(orgId: string, sessionId: string): Promise<ScheduledCallRecord | null> {
    const result = await this.client.execute({
      sql: "SELECT * FROM scheduled_calls WHERE org_id = ? AND session_id = ? LIMIT 1",
      args: [orgId, sessionId],
    });
    return result.rows.length ? mapScheduledCall(result.rows[0] as Row) : null;
  }
}

export function createScheduledCallStore(
  client: Client,
  options: CreateScheduledCallStoreOptions = {},
): LibsqlScheduledCallStore {
  return new LibsqlScheduledCallStore(client, options);
}

export interface ScheduledCallPollerOptions {
  operations: ScheduledCallOperations;
  orgId: string;
  workerId: string;
  now?: () => string;
  leaseMs?: number;
  intervalMs?: number;
  startCall: (job: ScheduledCallRecord) => Promise<string | null>;
  onProviderStart?: (job: ScheduledCallRecord, providerCallId: string | null) => Promise<void>;
  onProviderFailure?: (job: ScheduledCallRecord, error: unknown) => Promise<void>;
}

/** Single-task poller; provider invocation is deliberately an injected seam. */
export class ScheduledCallPoller {
  private readonly now: () => string;
  private readonly leaseMs: number;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | undefined;
  private inFlight: Promise<unknown> | undefined;

  constructor(private readonly options: ScheduledCallPollerOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.leaseMs = options.leaseMs ?? 30_000;
    this.intervalMs = options.intervalMs ?? 1_000;
    if (!Number.isInteger(this.leaseMs) || this.leaseMs <= 0) throw new Error("leaseMs must be a positive integer");
    if (!Number.isInteger(this.intervalMs) || this.intervalMs <= 0) throw new Error("intervalMs must be a positive integer");
  }

  async pollOnce(): Promise<ScheduledCallRecord | null> {
    const job = await this.options.operations.claimDue({ orgId: this.options.orgId, workerId: this.options.workerId, now: this.now(), leaseMs: this.leaseMs });
    if (!job) return null;
    try {
      const providerCallId = await this.options.startCall(job);
      await this.options.onProviderStart?.(job, providerCallId);
      return await this.options.operations.complete({
        orgId: job.orgId,
        scheduledCallId: job.scheduledCallId,
        workerId: this.options.workerId,
        providerCallId,
        now: this.now(),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failed = await this.options.operations.fail({
        orgId: job.orgId,
        scheduledCallId: job.scheduledCallId,
        workerId: this.options.workerId,
        reason,
        now: this.now(),
      });
      await this.options.onProviderFailure?.(job, error);
      return failed;
    }
  }

  start(): void {
    if (this.timer) return;
    const tick = () => {
      if (this.inFlight) return;
      this.inFlight = this.pollOnce().catch(() => undefined).finally(() => { this.inFlight = undefined; });
    };
    tick();
    this.timer = setInterval(tick, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}

function mapScheduledCall(row: Row): ScheduledCallRecord {
  return {
    scheduledCallId: String(row.scheduled_call_id),
    orgId: String(row.org_id),
    sessionId: String(row.session_id),
    scheduledAt: String(row.scheduled_at),
    status: String(row.status) as ScheduledCallStatus,
    attemptCount: Number(row.attempt_count),
    leaseOwner: nullableString(row.lease_owner),
    leaseExpiresAt: nullableString(row.lease_expires_at),
    providerCallId: nullableString(row.provider_call_id),
    error: nullableString(row.error),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function assertNonEmpty(value: string, name: string): void {
  if (!value.trim()) throw new Error(`${name} must not be empty`);
}

function assertTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error("scheduled call timestamps must be valid ISO timestamps");
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
