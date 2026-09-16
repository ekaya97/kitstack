import { createHash } from "node:crypto";
import type { AuditSink } from "./types";

/** Values that are safe to carry as audit metadata. Bodies are never accepted. */
export type AuditAttributeValue = string | number | boolean | null;
export type AuditAttributes = Readonly<Record<string, AuditAttributeValue>>;

export type AuditOutcome = "success" | "failure" | "denied";

/**
 * The content-free audit envelope. Payloads are represented only by hashes;
 * prompts, completions, transcripts, audio and tool arguments are excluded.
 */
export interface AuditEventInput {
  readonly eventId?: string;
  readonly timestamp?: string;
  readonly orgId: string;
  readonly appId?: string | null;
  readonly principal: string;
  readonly actor: string;
  readonly delegation?: string | null;
  readonly sessionId?: string | null;
  readonly traceId?: string | null;
  readonly parentId?: string | null;
  readonly channel?: string | null;
  readonly kitId?: string | null;
  readonly pluginId?: string | null;
  readonly action: string;
  readonly outcome: AuditOutcome;
  readonly errorCode?: string | null;
  readonly resultHash?: string | null;
  readonly attributes?: AuditAttributes;
}

export interface AuditRecord extends Omit<AuditEventInput, "eventId" | "timestamp" | "attributes"> {
  readonly eventId: string;
  readonly timestamp: string;
  readonly sequence: number;
  readonly previousHash: string | null;
  readonly hash: string;
  readonly attributes: AuditAttributes;
}

export interface AuditPersistence {
  append(record: AuditRecord): void | Promise<void>;
  list(): AuditRecord[] | Promise<AuditRecord[]>;
}

export interface AuditQuery {
  readonly orgId?: string;
  readonly appId?: string | null;
  readonly sessionId?: string;
  readonly traceId?: string;
  readonly action?: string;
  readonly outcome?: AuditOutcome;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
}

export interface AuditVerification {
  readonly valid: boolean;
  readonly records: number;
  readonly firstInvalidSequence?: number;
  readonly reason?: "sequence" | "previous_hash" | "hash" | "duplicate_event_id";
}

export type AuditExportFormat = "json" | "csv";

/** Adapter seam for shipping the same SIEM-shaped records to another sink. */
export interface AuditExporter {
  export(records: readonly AuditRecord[], format: AuditExportFormat): string | Promise<string>;
}

export interface AuditStore extends AuditSink {
  append(input: AuditEventInput): Promise<AuditRecord>;
  query(query?: AuditQuery): Promise<AuditRecord[]>;
  verify(): Promise<AuditVerification>;
  export(format?: AuditExportFormat, query?: AuditQuery): Promise<string>;
}

const SENSITIVE_KEYS = new Set([
  "prompt",
  "completion",
  "transcript",
  "audio",
  "recording",
  "toolargs",
  "tool_args",
  "toolpayload",
  "tool_payload",
  "toolresult",
  "tool_result",
  "arguments",
  "payload",
  "body",
  "content",
]);

/** Validate the runtime boundary as well as the TypeScript boundary. */
export function assertMetadataOnlyAudit(input: AuditEventInput): void {
  for (const key of Object.keys(input as object)) {
    if (SENSITIVE_KEYS.has(normalizeKey(key))) {
      throw new Error(`Audit store accepts metadata only; field "${key}" is not allowed`);
    }
  }

  if (input.attributes !== undefined) {
    for (const [key, value] of Object.entries(input.attributes)) {
      if (SENSITIVE_KEYS.has(normalizeKey(key))) {
        throw new Error(`Audit store accepts metadata only; attribute "${key}" is not allowed`);
      }
      if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
        throw new Error(`Audit attribute "${key}" must be a scalar metadata value`);
      }
    }
  }
}

/** Deterministic representation used for both chaining and independent checks. */
export function canonicalAuditRecord(record: Omit<AuditRecord, "hash">): string {
  return JSON.stringify({
    sequence: record.sequence,
    eventId: record.eventId,
    timestamp: record.timestamp,
    orgId: record.orgId,
    appId: record.appId ?? null,
    principal: record.principal,
    actor: record.actor,
    delegation: record.delegation ?? null,
    sessionId: record.sessionId ?? null,
    traceId: record.traceId ?? null,
    parentId: record.parentId ?? null,
    channel: record.channel ?? null,
    kitId: record.kitId ?? null,
    pluginId: record.pluginId ?? null,
    action: record.action,
    outcome: record.outcome,
    errorCode: record.errorCode ?? null,
    resultHash: record.resultHash ?? null,
    attributes: sortAttributes(record.attributes),
    previousHash: record.previousHash ?? null,
  });
}

export function hashAuditRecord(record: Omit<AuditRecord, "hash">): string {
  return createHash("sha256").update(canonicalAuditRecord(record), "utf8").digest("hex");
}

class MemoryAuditPersistence implements AuditPersistence {
  private records: AuditRecord[] = [];

  append(record: AuditRecord): void {
    this.records.push(record);
  }

  list(): AuditRecord[] {
    return [...this.records];
  }

}

export interface HashChainedAuditStoreOptions {
  readonly persistence?: AuditPersistence;
  readonly exporter?: AuditExporter;
  readonly now?: () => string;
  readonly createId?: () => string;
}

export interface HttpAuditExporterOptions {
  /** HTTPS endpoint owned by the organization's SIEM or ingestion gateway. */
  readonly endpoint: string;
  /** Static authentication and routing headers; never include event content. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

/**
 * Post the SDK's SIEM-shaped export to an external ingestion endpoint.
 * Serialization remains centralized in the default exporter, so this adapter
 * cannot accidentally send prompts, completions, audio, or tool arguments.
 */
export function createHttpAuditExporter(options: HttpAuditExporterOptions): AuditExporter {
  const endpoint = new URL(options.endpoint);
  if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
    throw new Error("Audit exporter endpoint must use http or https");
  }
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Audit exporter timeoutMs must be positive");
  }

  return {
    async export(records, format) {
      const body = defaultAuditExporter.export(records, format);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetcher(endpoint, {
          method: "POST",
          headers: {
            "content-type": format === "csv" ? "text/csv" : "application/json",
            ...options.headers,
          },
          body,
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Audit exporter responded with HTTP ${response.status}`);
        }
        return body;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

/**
 * SDK base implementation. Hosts can replace the memory persistence with a
 * database/table adapter while retaining identical chaining and export rules.
 */
export class HashChainedAuditStore implements AuditStore {
  private readonly persistence: AuditPersistence;
  private readonly now: () => string;
  private readonly createId: () => string;
  private readonly exporter: AuditExporter;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options: HashChainedAuditStoreOptions = {}) {
    this.persistence = options.persistence ?? new MemoryAuditPersistence();
    this.exporter = options.exporter ?? defaultAuditExporter;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? (() => crypto.randomUUID());
  }

  async append(input: AuditEventInput): Promise<AuditRecord> {
    assertMetadataOnlyAudit(input);
    let appended!: AuditRecord;
    const write = this.writeQueue.then(async () => {
      const records = await this.persistence.list();
      const previous = records[records.length - 1];
      const recordWithoutHash: Omit<AuditRecord, "hash"> = Object.freeze({
        eventId: input.eventId ?? this.createId(),
        timestamp: input.timestamp ?? this.now(),
        orgId: input.orgId,
        appId: input.appId ?? null,
        principal: input.principal,
        actor: input.actor,
        delegation: input.delegation ?? null,
        sessionId: input.sessionId ?? null,
        traceId: input.traceId ?? null,
        parentId: input.parentId ?? null,
        channel: input.channel ?? null,
        kitId: input.kitId ?? null,
        pluginId: input.pluginId ?? null,
        action: input.action,
        outcome: input.outcome,
        errorCode: input.errorCode ?? null,
        resultHash: input.resultHash ?? null,
        attributes: Object.freeze({ ...input.attributes }),
        sequence: previous ? previous.sequence + 1 : 1,
        previousHash: previous?.hash ?? null,
      });
      if (records.some((record) => record.eventId === recordWithoutHash.eventId)) {
        throw new Error(`Audit event already exists: ${recordWithoutHash.eventId}`);
      }
      appended = Object.freeze({ ...recordWithoutHash, hash: hashAuditRecord(recordWithoutHash) });
      await this.persistence.append(appended);
    });
    this.writeQueue = write.catch(() => undefined);
    await write;
    return appended;
  }

  async record(event: AuditEventInput): Promise<void> {
    await this.append(event);
  }

  async query(query: AuditQuery = {}): Promise<AuditRecord[]> {
    const records = await this.persistence.list();
    return records
      .filter((record) => (
        (query.orgId === undefined || record.orgId === query.orgId) &&
        (query.appId === undefined || record.appId === query.appId) &&
        (query.sessionId === undefined || record.sessionId === query.sessionId) &&
        (query.traceId === undefined || record.traceId === query.traceId) &&
        (query.action === undefined || record.action === query.action) &&
        (query.outcome === undefined || record.outcome === query.outcome) &&
        (query.from === undefined || record.timestamp >= query.from) &&
        (query.to === undefined || record.timestamp < query.to)
      ))
      .slice(0, normalizeLimit(query.limit))
      .map((record) => Object.freeze({ ...record, attributes: Object.freeze({ ...record.attributes }) }));
  }

  async verify(): Promise<AuditVerification> {
    const records = await this.persistence.list();
    const ids = new Set<string>();
    let previousHash: string | null = null;
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (ids.has(record.eventId)) return invalid(records.length, record.sequence, "duplicate_event_id");
      ids.add(record.eventId);
      if (record.sequence !== index + 1) return invalid(records.length, record.sequence, "sequence");
      if (record.previousHash !== previousHash) return invalid(records.length, record.sequence, "previous_hash");
      if (record.hash !== hashAuditRecord(record)) return invalid(records.length, record.sequence, "hash");
      previousHash = record.hash;
    }
    return { valid: true, records: records.length };
  }

  async export(format: AuditExportFormat = "json", query: AuditQuery = {}): Promise<string> {
    const records = await this.query(query);
    return this.exporter.export(records, format);
  }

}
function invalid(records: number, sequence: number, reason: AuditVerification["reason"]): AuditVerification {
  return { valid: false, records, firstInvalidSequence: sequence, reason };
}

const defaultAuditExporter: AuditExporter = {
  export(records, format) {
    const exported = records.map(toExportRecord);
    if (format === "json") return JSON.stringify(exported, null, 2);
    if (format !== "csv") throw new Error(`Unsupported audit export format: ${format}`);
    const fields = [...exportFields];
    return [fields.join(","), ...exported.map((record) => fields.map((field) => csvValue(record[field])).join(","))].join("\n");
  },
};

const exportFields = [
  "eventId", "timestamp", "sequence", "orgId", "appId", "principal", "actor", "delegation",
  "sessionId", "traceId", "parentId", "channel", "kitId", "pluginId", "action", "outcome",
  "errorCode", "resultHash", "previousHash", "hash", "attributes",
] as const;

type ExportRecord = Record<(typeof exportFields)[number], string | number | null>;

function toExportRecord(record: AuditRecord): ExportRecord {
  return {
    eventId: record.eventId,
    timestamp: record.timestamp,
    sequence: record.sequence,
    orgId: record.orgId,
    appId: record.appId ?? null,
    principal: record.principal,
    actor: record.actor,
    delegation: record.delegation ?? null,
    sessionId: record.sessionId ?? null,
    traceId: record.traceId ?? null,
    parentId: record.parentId ?? null,
    channel: record.channel ?? null,
    kitId: record.kitId ?? null,
    pluginId: record.pluginId ?? null,
    action: record.action,
    outcome: record.outcome,
    errorCode: record.errorCode ?? null,
    resultHash: record.resultHash ?? null,
    previousHash: record.previousHash ?? null,
    hash: record.hash,
    attributes: JSON.stringify(sortAttributes(record.attributes)),
  };
}

function csvValue(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function normalizeKey(key: string): string {
  return key.replaceAll(/[\s-]/g, "_").toLowerCase();
}

function sortAttributes(attributes: AuditAttributes): AuditAttributes {
  return Object.fromEntries(Object.entries(attributes).sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 1000;
  return Math.min(10000, Math.max(1, Math.floor(value)));
}
