import { describe, expect, it } from "vitest";
import { createKitContext } from "../src/context";
import { assertStorageScope, requireStorageObjects, requireStorageSql, type StorageAdapter } from "../src/storage";

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
    const sqlOnly: StorageAdapter = { provider: "shared-sql", scope: { orgId: "org", kitId: "kit" }, capabilities: ["sql"] };
    expect(() => requireStorageObjects(sqlOnly)).toThrow("object capability");
  });
});
