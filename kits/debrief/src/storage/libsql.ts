import { createHash } from "node:crypto";
import type { Client, InValue } from "@libsql/client";
import {
  assertStorageScope,
  type StorageAdapter,
  type StorageObject,
  type StorageObjectAdapter,
  type StorageObjectInput,
  type StorageResult,
  type StorageScope,
  type StorageSqlAdapter,
  type StorageStatement,
  type StorageValue,
} from "@kitstackco/sdk";

export interface CreateLibsqlStorageOptions {
  readonly scope: StorageScope;
  readonly now?: () => string;
}

const OBJECT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS kitstack_storage_objects (
    org_id TEXT NOT NULL,
    kit_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    object_key TEXT NOT NULL,
    body BLOB NOT NULL,
    content_type TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    etag TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (org_id, kit_id, tenant_id, object_key)
  );
  CREATE INDEX IF NOT EXISTS kitstack_storage_objects_prefix_idx
    ON kitstack_storage_objects (org_id, kit_id, tenant_id, object_key);
`;

type Row = Record<string, unknown>;

/**
 * First-party libSQL adapter for the SDK storage contract.
 *
 * The client is created by the host, so Turso URLs and auth tokens never cross
 * the SDK/kit capability boundary. Object rows are scoped by org, kit, and
 * tenant on every operation; the same scope is available to future shared SQL
 * and DynamoDB adapters.
 */
export class LibsqlStorageAdapter implements StorageAdapter {
  readonly provider = "libsql" as const;
  readonly scope: StorageScope;
  readonly capabilities = ["sql", "objects"] as const;
  readonly sql: StorageSqlAdapter;
  readonly objects: StorageObjectAdapter;
  private readonly initialized: Promise<void>;
  private readonly now: () => string;

  constructor(private readonly client: Client, options: CreateLibsqlStorageOptions) {
    assertStorageScope(options.scope);
    this.scope = Object.freeze({ ...options.scope, tenantId: options.scope.tenantId ?? "default" });
    this.now = options.now ?? (() => new Date().toISOString());
    this.sql = {
      execute: (statement) => this.execute(statement),
      batch: (statements) => this.batch(statements),
    };
    this.initialized = this.client.executeMultiple(OBJECT_SCHEMA_SQL).then(() => undefined);
    this.objects = {
      put: (input) => this.putObject(input),
      get: (key) => this.getObject(key),
      delete: (key) => this.deleteObject(key),
      list: (prefix) => this.listObjects(prefix),
    };
  }

  private async execute<RowType extends Record<string, unknown> = Record<string, unknown>>(
    statement: StorageStatement | string,
  ): Promise<StorageResult<RowType>> {
    const result = await this.client.execute(toClientStatement(statement));
    return {
      columns: result.columns,
      rows: result.rows as unknown as RowType[],
      rowsAffected: result.rowsAffected,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  private async batch(statements: readonly (StorageStatement | string)[]): Promise<readonly StorageResult[]> {
    const results = await this.client.batch(statements.map(toClientStatement));
    return results.map((result) => ({
      columns: result.columns,
      rows: result.rows as unknown as Row[],
      rowsAffected: result.rowsAffected,
      lastInsertRowid: result.lastInsertRowid,
    }));
  }

  private async putObject(input: StorageObjectInput): Promise<StorageObject> {
    await this.initialized;
    if (!input.key.trim()) throw new Error("Storage object key must not be empty");
    const timestamp = this.now();
    const etag = createHash("sha256").update(input.body).digest("hex");
    await this.client.execute({
      sql: `INSERT INTO kitstack_storage_objects
        (org_id, kit_id, tenant_id, object_key, body, content_type, metadata_json, etag, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(org_id, kit_id, tenant_id, object_key) DO UPDATE SET
          body = excluded.body, content_type = excluded.content_type,
          metadata_json = excluded.metadata_json, etag = excluded.etag, updated_at = excluded.updated_at`,
      args: [
        this.scope.orgId, this.scope.kitId, this.scope.tenantId!, input.key, input.body,
        input.contentType ?? "application/octet-stream", JSON.stringify(input.metadata ?? {}), etag, timestamp, timestamp,
      ] as InValue[],
    });
    return { ...input, body: new Uint8Array(input.body), contentType: input.contentType ?? "application/octet-stream", metadata: { ...input.metadata }, etag, createdAt: timestamp, updatedAt: timestamp };
  }

  private async getObject(key: string): Promise<StorageObject | null> {
    await this.initialized;
    const result = await this.client.execute({
      sql: `SELECT object_key, body, content_type, metadata_json, etag, created_at, updated_at
        FROM kitstack_storage_objects
        WHERE org_id = ? AND kit_id = ? AND tenant_id = ? AND object_key = ? LIMIT 1`,
      args: [this.scope.orgId, this.scope.kitId, this.scope.tenantId!, key],
    });
    return result.rows.length ? mapObject(result.rows[0] as Row) : null;
  }

  private async deleteObject(key: string): Promise<void> {
    await this.initialized;
    await this.client.execute({
      sql: `DELETE FROM kitstack_storage_objects
        WHERE org_id = ? AND kit_id = ? AND tenant_id = ? AND object_key = ?`,
      args: [this.scope.orgId, this.scope.kitId, this.scope.tenantId!, key],
    });
  }

  private async listObjects(prefix = ""): Promise<readonly StorageObject[]> {
    await this.initialized;
    const result = await this.client.execute({
      sql: `SELECT object_key, body, content_type, metadata_json, etag, created_at, updated_at
        FROM kitstack_storage_objects
        WHERE org_id = ? AND kit_id = ? AND tenant_id = ? AND object_key LIKE ?
        ORDER BY object_key ASC`,
      args: [this.scope.orgId, this.scope.kitId, this.scope.tenantId!, `${prefix}%`],
    });
    return result.rows.map((row) => mapObject(row as Row));
  }
}

export function createLibsqlStorageAdapter(
  client: Client,
  options: CreateLibsqlStorageOptions,
): LibsqlStorageAdapter {
  return new LibsqlStorageAdapter(client, options);
}

function toClientStatement(statement: StorageStatement | string): { sql: string; args: InValue[] } {
  if (typeof statement === "string") return { sql: statement, args: [] };
  return { sql: statement.sql, args: (statement.args ?? []) as InValue[] };
}

function mapObject(row: Row): StorageObject {
  return {
    key: String(row.object_key),
    body: toBytes(row.body),
    contentType: String(row.content_type),
    metadata: decodeMetadata(row.metadata_json),
    etag: String(row.etag),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  return new TextEncoder().encode(String(value ?? ""));
}

function decodeMetadata(value: unknown): Readonly<Record<string, string>> {
  try {
    const parsed: unknown = JSON.parse(String(value ?? "{}"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}
