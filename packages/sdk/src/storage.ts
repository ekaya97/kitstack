import { assertBindingScope, assertBindingScopeMatches, type BindingScope } from "./binding-scope";

/**
 * Provider-neutral storage contracts.
 *
 * The SDK deliberately does not import a database driver. Hosts resolve
 * credentials and construct an adapter at bind time; kit code receives only
 * this request-scoped capability. The legacy `ctx.db` Drizzle field remains
 * available while maintained kits migrate to `ctx.storage`.
 */

export type StorageProvider = "libsql" | "shared-sql" | "dynamodb" | "object-store";

/** Organization/kit boundary supplied by the authenticated host. */
export type StorageScope = BindingScope;

export type StorageValue = string | number | bigint | boolean | Uint8Array | ArrayBuffer | null;

export interface StorageStatement {
  readonly sql: string;
  readonly args?: readonly StorageValue[];
}

export interface StorageResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  readonly columns: readonly string[];
  readonly rows: readonly Row[];
  readonly rowsAffected: number;
  readonly lastInsertRowid?: bigint | number;
}

/** SQL-shaped operations shared by relational providers. */
export interface StorageSqlAdapter {
  execute<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: StorageStatement | string,
  ): Promise<StorageResult<Row>>;
  batch(statements: readonly (StorageStatement | string)[]): Promise<readonly StorageResult[]>;
}

export interface StorageObjectInput {
  readonly key: string;
  readonly body: Uint8Array;
  readonly contentType?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface StorageObject extends StorageObjectInput {
  readonly etag: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Binary storage for screenshots, markup, recordings, and other blobs. */
export interface StorageObjectAdapter {
  put(input: StorageObjectInput): Promise<StorageObject>;
  get(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<readonly StorageObject[]>;
}

/**
 * The host-bound storage capability available to a kit request.
 *
 * `sql` is optional for key/value or object-only providers. `objects` is
 * optional for relational-only providers. Implementations must enforce the
 * supplied scope and must not expose credentials through this object.
 */
export type StorageCapability = "sql" | "objects";

export interface StorageAdapter {
  readonly provider: StorageProvider;
  readonly scope: StorageScope;
  readonly capabilities: readonly StorageCapability[];
  readonly sql?: StorageSqlAdapter;
  readonly objects?: StorageObjectAdapter;
}

export function assertStorageScope(scope: StorageScope): void {
  assertBindingScope(scope, "Storage scope");
}

/** Validate the host boundary before exposing a storage capability to a kit. */
export function assertStorageAdapter(storage: StorageAdapter): void {
  assertStorageScope(storage.scope);
  const capabilities = new Set(storage.capabilities);
  if (capabilities.size !== storage.capabilities.length) {
    throw new Error("Storage adapter capabilities must not contain duplicates");
  }

  const hasSql = storage.sql !== undefined;
  const hasObjects = storage.objects !== undefined;
  if (hasSql !== capabilities.has("sql")) {
    throw new Error("Storage adapter SQL implementation must match its capabilities");
  }
  if (hasObjects !== capabilities.has("objects")) {
    throw new Error("Storage adapter object implementation must match its capabilities");
  }
}

/** Bind an adapter to the exact org/kit scope requested by the host. */
export function bindStorageAdapter<T extends StorageAdapter>(storage: T, scope: StorageScope): T {
  assertStorageAdapter(storage);
  assertBindingScopeMatches(storage.scope, scope, "Storage scope");
  return storage;
}

export function requireStorageSql(storage: StorageAdapter): StorageSqlAdapter {
  assertStorageAdapter(storage);
  if (!storage.sql) throw new Error(`Storage provider "${storage.provider}" does not provide SQL capability`);
  return storage.sql;
}

export function requireStorageObjects(storage: StorageAdapter): StorageObjectAdapter {
  assertStorageAdapter(storage);
  if (!storage.objects) throw new Error(`Storage provider "${storage.provider}" does not provide object capability`);
  return storage.objects;
}
