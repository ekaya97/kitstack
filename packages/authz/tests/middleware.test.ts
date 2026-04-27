import { describe, it, expect, beforeEach } from "vitest";
import { authorize } from "../src/middleware";
import { grantRelation } from "../src/lifecycle";
import { createTestDb } from "./helpers";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

let db: LibSQLDatabase<any>;

beforeEach(async () => {
  db = await createTestDb();
});

describe("authorize", () => {
  it("allows when requirements list is empty (auth-only)", async () => {
    const result = await authorize(db, { userId: "user-1" }, []);
    expect(result.allowed).toBe(true);
    expect(result.failedCheck).toBeUndefined();
  });

  it("allows when a single requirement is satisfied", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    const result = await authorize(db, { userId: "user-1" }, [
      { relation: "activator", objectType: "kit", objectId: "crm" },
    ]);
    expect(result.allowed).toBe(true);
  });

  it("rejects when a single requirement is not satisfied", async () => {
    const result = await authorize(db, { userId: "user-1" }, [
      { relation: "activator", objectType: "kit", objectId: "crm" },
    ]);
    expect(result.allowed).toBe(false);
    expect(result.failedCheck).toEqual({
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    expect(result.reason).toContain("activator");
    expect(result.reason).toContain("kit:crm");
  });

  it("allows when all requirements are satisfied", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    await grantRelation(db, "user-1", "subscriber", "subscription", "sub-1");

    const result = await authorize(db, { userId: "user-1" }, [
      { relation: "activator", objectType: "kit", objectId: "crm" },
      { relation: "subscriber", objectType: "subscription", objectId: "sub-1" },
    ]);
    expect(result.allowed).toBe(true);
  });

  it("rejects on the first unsatisfied requirement", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    // user-1 does NOT have "subscriber" on "subscription:sub-1"

    const result = await authorize(db, { userId: "user-1" }, [
      { relation: "activator", objectType: "kit", objectId: "crm" },
      { relation: "subscriber", objectType: "subscription", objectId: "sub-1" },
    ]);
    expect(result.allowed).toBe(false);
    expect(result.failedCheck).toEqual({
      relation: "subscriber",
      objectType: "subscription",
      objectId: "sub-1",
    });
  });

  it("rejects immediately on first failure without checking remaining", async () => {
    // Neither requirement is satisfied — should fail on the first one
    const result = await authorize(db, { userId: "user-1" }, [
      { relation: "activator", objectType: "kit", objectId: "crm" },
      { relation: "subscriber", objectType: "subscription", objectId: "sub-1" },
    ]);
    expect(result.allowed).toBe(false);
    expect(result.failedCheck!.relation).toBe("activator");
  });

  it("uses userId from context as subjectId", async () => {
    await grantRelation(db, "user-42", "author", "review", "rev-1");
    const result = await authorize(db, { userId: "user-42" }, [
      { relation: "author", objectType: "review", objectId: "rev-1" },
    ]);
    expect(result.allowed).toBe(true);
  });

  it("different users get different authorization results", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");

    const user1 = await authorize(db, { userId: "user-1" }, [
      { relation: "activator", objectType: "kit", objectId: "crm" },
    ]);
    const user2 = await authorize(db, { userId: "user-2" }, [
      { relation: "activator", objectType: "kit", objectId: "crm" },
    ]);
    expect(user1.allowed).toBe(true);
    expect(user2.allowed).toBe(false);
  });
});
