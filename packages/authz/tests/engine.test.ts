import { describe, it, expect, beforeEach } from "vitest";
import { check, listObjects, listSubjects } from "../src/engine";
import { grantRelation } from "../src/lifecycle";
import { createTestDb } from "./helpers";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

let db: LibSQLDatabase<any>;

beforeEach(async () => {
  db = await createTestDb();
});

describe("check", () => {
  it("returns allowed:true when the tuple exists", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    const result = await check(db, {
      subjectId: "user-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    expect(result).toEqual({ allowed: true });
  });

  it("returns allowed:false when the tuple does not exist", async () => {
    const result = await check(db, {
      subjectId: "user-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    expect(result).toEqual({ allowed: false });
  });

  it("defaults subjectType to 'user'", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm", "user");
    const result = await check(db, {
      subjectId: "user-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
      // no subjectType — should default to "user"
    });
    expect(result.allowed).toBe(true);
  });

  it("respects explicit subjectType", async () => {
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

  it("does not match across different subjectTypes", async () => {
    await grantRelation(db, "id-1", "activator", "kit", "crm", "team");
    const result = await check(db, {
      subjectType: "user",
      subjectId: "id-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    expect(result.allowed).toBe(false);
  });

  it("does not match across different relations", async () => {
    await grantRelation(db, "user-1", "subscriber", "kit", "crm");
    const result = await check(db, {
      subjectId: "user-1",
      relation: "activator",
      objectType: "kit",
      objectId: "crm",
    });
    expect(result.allowed).toBe(false);
  });

  it("does not match across different objectIds", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    const result = await check(db, {
      subjectId: "user-1",
      relation: "activator",
      objectType: "kit",
      objectId: "expense",
    });
    expect(result.allowed).toBe(false);
  });
});

describe("listObjects", () => {
  it("returns all matching objectIds", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    await grantRelation(db, "user-1", "activator", "kit", "expense");
    await grantRelation(db, "user-1", "activator", "kit", "outreach");

    const objects = await listObjects(db, "user-1", "activator", "kit");
    expect(objects).toHaveLength(3);
    expect(objects).toContain("crm");
    expect(objects).toContain("expense");
    expect(objects).toContain("outreach");
  });

  it("returns empty array when no tuples match", async () => {
    const objects = await listObjects(db, "user-1", "activator", "kit");
    expect(objects).toEqual([]);
  });

  it("does not return objects for a different relation", async () => {
    await grantRelation(db, "user-1", "subscriber", "kit", "crm");
    const objects = await listObjects(db, "user-1", "activator", "kit");
    expect(objects).toEqual([]);
  });

  it("does not return objects for a different subject", async () => {
    await grantRelation(db, "user-2", "activator", "kit", "crm");
    const objects = await listObjects(db, "user-1", "activator", "kit");
    expect(objects).toEqual([]);
  });

  it("supports team subjectType", async () => {
    await grantRelation(db, "team-1", "activator", "kit", "crm", "team");
    const objects = await listObjects(db, "team-1", "activator", "kit", "team");
    expect(objects).toEqual(["crm"]);
  });
});

describe("listSubjects", () => {
  it("returns all subjects with the given relation on the object", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "crm");
    await grantRelation(db, "user-2", "activator", "kit", "crm");
    await grantRelation(db, "user-3", "activator", "kit", "crm");

    const subjects = await listSubjects(db, "activator", "kit", "crm");
    expect(subjects).toHaveLength(3);
    expect(subjects).toContain("user-1");
    expect(subjects).toContain("user-2");
    expect(subjects).toContain("user-3");
  });

  it("returns empty array when no subjects match", async () => {
    const subjects = await listSubjects(db, "activator", "kit", "crm");
    expect(subjects).toEqual([]);
  });

  it("does not return subjects with a different relation", async () => {
    await grantRelation(db, "user-1", "subscriber", "kit", "crm");
    const subjects = await listSubjects(db, "activator", "kit", "crm");
    expect(subjects).toEqual([]);
  });

  it("does not return subjects for a different objectId", async () => {
    await grantRelation(db, "user-1", "activator", "kit", "expense");
    const subjects = await listSubjects(db, "activator", "kit", "crm");
    expect(subjects).toEqual([]);
  });
});
