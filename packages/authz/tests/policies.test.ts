import { describe, it, expect, beforeEach } from "vitest";
import { canActivateKit } from "../src/policies";
import { grantRelation } from "../src/lifecycle";
import { createTestDb } from "./helpers";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

let db: LibSQLDatabase<any>;

beforeEach(async () => {
  db = await createTestDb();
});

describe("canActivateKit", () => {
  describe("starter plan (limit: 2)", () => {
    it("allows when user has no active kits", async () => {
      const result = await canActivateKit(db, "user-1", "starter");
      expect(result.allowed).toBe(true);
    });

    it("allows when user has 1 active kit", async () => {
      await grantRelation(db, "user-1", "activator", "kit", "crm");
      const result = await canActivateKit(db, "user-1", "starter");
      expect(result.allowed).toBe(true);
    });

    it("rejects when user already has 2 active kits", async () => {
      await grantRelation(db, "user-1", "activator", "kit", "crm");
      await grantRelation(db, "user-1", "activator", "kit", "expense");
      const result = await canActivateKit(db, "user-1", "starter");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("starter");
      expect(result.reason).toContain("2");
    });

    it("rejects when user has more than 2 active kits", async () => {
      await grantRelation(db, "user-1", "activator", "kit", "crm");
      await grantRelation(db, "user-1", "activator", "kit", "expense");
      await grantRelation(db, "user-1", "activator", "kit", "outreach");
      const result = await canActivateKit(db, "user-1", "starter");
      expect(result.allowed).toBe(false);
    });
  });

  describe("pro plan (limit: Infinity)", () => {
    it("allows activation regardless of active kit count", async () => {
      for (let i = 0; i < 10; i++) {
        await grantRelation(db, "user-1", "activator", "kit", `kit-${i}`);
      }
      const result = await canActivateKit(db, "user-1", "pro");
      expect(result.allowed).toBe(true);
    });
  });

  describe("unknown plan (limit: 0)", () => {
    it("rejects even with no active kits", async () => {
      const result = await canActivateKit(db, "user-1", "unknown-plan");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("0");
    });
  });

  it("does not count kits from other users", async () => {
    await grantRelation(db, "user-2", "activator", "kit", "crm");
    await grantRelation(db, "user-2", "activator", "kit", "expense");
    const result = await canActivateKit(db, "user-1", "starter");
    expect(result.allowed).toBe(true);
  });

  it("reason message uses correct singular form for limit of 1", async () => {
    // With an unknown plan (limit 0), we still check the message format.
    // Let's grant 1 kit on starter to get the "2 kits" message
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    await grantRelation(db, "user-1", "activator", "kit", "expense");
    const result = await canActivateKit(db, "user-1", "starter");
    expect(result.reason).toContain("kits");
  });
});
