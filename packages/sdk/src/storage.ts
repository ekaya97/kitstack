/**
 * Provider-neutral storage contracts.
 *
 * The SDK deliberately does not import a database driver. Hosts resolve
 * credentials and construct an adapter at bind time; kit code receives only
 * this request-scoped capability. The legacy `ctx.db` Drizzle field remains
 * available while maintained kits migrate to `ctx.storage`.
 */

export type StorageProvider = "libsql" | "shared-sql" | "dynamodb" | "object-store";

export interface StorageScope {
  /** Organization/tenant boundary supplied by the authenticated host. */
  readonly orgId: string;
  /** Kit boundary; prevents one kit from reading another kit's objects. */
  readonly kitId: string;
  readonly tenantId?: string;
}

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
export interface StorageAdapter {
  readonly provider: StorageProvider;
  readonly scope: StorageScope;
  readonly capabilities: readonly ("sql" | "objects")[];
  readonly sql?: StorageSqlAdapter;
  readonly objects?: StorageObjectAdapter;
}

export function assertStorageScope(scope: StorageScope): void {
  if (!scope.orgId.trim()) throw new Error("Storage scope orgId must not be empty");
  if (!scope.kitId.trim()) throw new Error("Storage scope kitId must not be empty");
  if (scope.tenantId !== undefined && !scope.tenantId.trim()) {
    throw new Error("Storage scope tenantId must not be empty when supplied");
  }
}

export function requireStorageSql(storage: StorageAdapter): StorageSqlAdapter {
  if (!storage.sql) throw new Error(`Storage provider "${storage.provider}" does not provide SQL capability`);
  return storage.sql;
}

export function requireStorageObjects(storage: StorageAdapter): StorageObjectAdapter {
  if (!storage.objects) throw new Error(`Storage provider "${storage.provider}" does not provide object capability`);
  return storage.objects;
}
