import { describe, it, expect, beforeEach } from "vitest";
import { grantRelation, revokeRelation, revokeAllForSubject } from "../src/lifecycle";
import { check, listObjects } from "../src/engine";
import { createTestDb } from "./helpers";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

let db: LibSQLDatabase<any>;

beforeEach(async () => {
  db = await createTestDb();
});

describe("grantRelation", () => {
  it("creates a tuple that can be checked", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    const result = await check(db, {
      subjectId: "user-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    expect(result.allowed).toBe(true);
  });

  it("is idempotent — granting the same tuple twice does not error", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    await grantRelation(db, "user-1", "activator", "kit", "crm");

    const objects = await listObjects(db, "user-1", "activator", "kit");
    expect(objects).toEqual(["crm"]);
  });

  it("creates distinct tuples for different relations", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    await grantRelation(db, "user-1", "subscriber", "kit", "crm");

    const asActivator = await check(db, {
      subjectId: "user-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    const asSubscriber = await check(db, {
      subjectId: "user-1",
      relation: "subscriber",
      objectType: "kit",
      objectId: "crm",
    });
    expect(asActivator.allowed).toBe(true);
    expect(asSubscriber.allowed).toBe(true);
  });

  it("defaults subjectType to 'user'", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    const result = await check(db, {
      subjectType: "user",
      subjectId: "user-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    expect(result.allowed).toBe(true);
  });

  it("supports team subjectType", async () => {
    await grantRelation(db, "team-1", "activator", "kit", "crm", "team");
    const result = await check(db, {
      subjectType: "team",
      subjectId: "team-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    expect(result.allowed).toBe(true);
  });
});

describe("revokeRelation", () => {
  it("removes a specific tuple", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    await revokeRelation(db, "user-1", "activator", "kit", "crm");

    const result = await check(db, {
      subjectId: "user-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    expect(result.allowed).toBe(false);
  });

  it("does not affect other tuples for the same subject", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    await grantRelation(db, "user-1", "activator", "kit", "expense");
    await revokeRelation(db, "user-1", "activator", "kit", "crm");

    const remaining = await listObjects(db, "user-1", "activator", "kit");
    expect(remaining).toEqual(["expense"]);
  });

  it("is a no-op when the tuple does not exist", async () => {
    // Should not throw
    await revokeRelation(db, "user-1", "activator", "kit", "nonexistent");
  });

  it("only revokes the exact matching tuple", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    await grantRelation(db, "user-1", "subscriber", "kit", "crm");

    await revokeRelation(db, "user-1", "activator", "kit", "crm");

    const activator = await check(db, {
      subjectId: "user-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    const subscriber = await check(db, {
      subjectId: "user-1",
      relation: "subscriber",
      objectType: "kit",
      objectId: "crm",
    });
    expect(activator.allowed).toBe(false);
    expect(subscriber.allowed).toBe(true);
  });
});

describe("revokeAllForSubject", () => {
  it("removes all tuples for a subject", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    await grantRelation(db, "user-1", "subscriber", "subscription", "sub-1");
    await grantRelation(db, "user-1", "author", "review", "rev-1");

    await revokeAllForSubject(db, "user-1");

    const kits = await listObjects(db, "user-1", "activator", "kit");
    const subs = await listObjects(db, "user-1", "subscriber", "subscription");
    const reviews = await listObjects(db, "user-1", "author", "review");
    expect(kits).toEqual([]);
    expect(subs).toEqual([]);
    expect(reviews).toEqual([]);
  });

  it("does not affect other subjects", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    await grantRelation(db, "user-2", "activator", "kit", "crm");

    await revokeAllForSubject(db, "user-1");

    const user1 = await check(db, {
      subjectId: "user-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    const user2 = await check(db, {
      subjectId: "user-2",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    expect(user1.allowed).toBe(false);
    expect(user2.allowed).toBe(true);
  });

  it("scopes by subjectType — does not revoke team tuples when revoking user", async () => {
    await grantRelation(db, "id-1", "activator", "kit", "crm", "user");
    await grantRelation(db, "id-1", "activator", "kit", "crm", "team");

    await revokeAllForSubject(db, "id-1", "user");

    const userCheck = await check(db, {
      subjectType: "user",
      subjectId: "id-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    const teamCheck = await check(db, {
      subjectType: "team",
      subjectId: "id-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    expect(userCheck.allowed).toBe(false);
    expect(teamCheck.allowed).toBe(true);
  });

  it("is a no-op when the subject has no tuples", async () => {
    await revokeAllForSubject(db, "ghost-user");
  });
});
