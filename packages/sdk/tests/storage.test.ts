import { describe, expect, it } from "vitest";
import { createKitContext } from "../src/context";
import {
  assertStorageAdapter,
  assertStorageScope,
  bindStorageAdapter,
  requireStorageObjects,
  requireStorageSql,
  type StorageAdapter,
  type StorageObject,
} from "../src/storage";

describe("provider-neutral storage contract", () => {
  it("passes a host-bound storage adapter through the request context", () => {
    const storage: StorageAdapter = {
      provider: "shared-sql",
      scope: { orgId: "org-1", kitId: "kit-1" },
      capabilities: ["sql"],
      sql: { execute: async () => ({ columns: [], rows: [], rowsAffected: 0 }), batch: async () => [] },
    };
    const context = createKitContext({ db: {} as never, storage });
    expect(context.storage).toBe(storage);
    expect(requireStorageSql(storage)).toBe(storage.sql);
    expect(storage.scope).toEqual({ orgId: "org-1", kitId: "kit-1" });
  });

  it("validates the mandatory tenant boundary and capability errors", () => {
    expect(() => assertStorageScope({ orgId: "", kitId: "kit" })).toThrow("orgId");
    expect(() => assertStorageScope({ orgId: "org", kitId: "" })).toThrow("kitId");
    expect(() => assertStorageScope({ orgId: "org", kitId: "kit", tenantId: " " })).toThrow("tenantId");
    const sqlOnly: StorageAdapter = {
      provider: "shared-sql",
      scope: { orgId: "org", kitId: "kit" },
      capabilities: ["sql"],
      sql: { execute: async () => ({ columns: [], rows: [], rowsAffected: 0 }), batch: async () => [] },
    };
    expect(() => requireStorageObjects(sqlOnly)).toThrow("object capability");
    expect(() => assertStorageAdapter({ ...sqlOnly, capabilities: ["sql", "sql"] })).toThrow(/duplicates/);
    expect(() => assertStorageAdapter({ ...sqlOnly, capabilities: ["objects"] })).toThrow(/SQL implementation/);
    expect(() => bindStorageAdapter(sqlOnly, { orgId: "other-org", kitId: "kit" })).toThrow(/does not match/);
  });

  it("covers local SQL and object adapters without pulling a provider into the SDK", async () => {
    const statements: string[] = [];
    const objects = new Map<string, StorageObject>();
    const now = "2026-09-17T00:00:00.000Z";
    const storage: StorageAdapter = {
      provider: "libsql",
      scope: { orgId: "org-demo", kitId: "kit-demo" },
      capabilities: ["sql", "objects"],
      sql: {
        execute: async (statement) => {
          statements.push(typeof statement === "string" ? statement : statement.sql);
          return { columns: ["id"], rows: [], rowsAffected: 1 };
        },
        batch: async (batch) => {
          batch.forEach((statement) => statements.push(typeof statement === "string" ? statement : statement.sql));
          return batch.map(() => ({ columns: [], rows: [], rowsAffected: 0 }));
        },
      },
      objects: {
        put: async (input) => {
          const object: StorageObject = { ...input, etag: "etag-1", createdAt: now, updatedAt: now };
          objects.set(input.key, object);
          return object;
        },
        get: async (key) => objects.get(key) ?? null,
        delete: async (key) => { objects.delete(key); },
        list: async (prefix = "") => [...objects.values()].filter((object) => object.key.startsWith(prefix)),
      },
    };

    assertStorageAdapter(storage);
    bindStorageAdapter(storage, { orgId: "org-demo", kitId: "kit-demo" });
    await requireStorageSql(storage).execute({ sql: "select 1", args: [] });
    const stored = await requireStorageObjects(storage).put({ key: "objects/demo.txt", body: new Uint8Array([1, 2, 3]), contentType: "text/plain" });
    expect(stored.key).toBe("objects/demo.txt");
    expect(await requireStorageObjects(storage).get(stored.key)).toEqual(stored);
    expect(statements).toEqual(["select 1"]);
  });
});
