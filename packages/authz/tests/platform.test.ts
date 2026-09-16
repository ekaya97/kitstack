import { describe, it, expect, beforeEach } from "vitest";
import { check, VersionedGrantCache } from "../src/engine";
import {
  grantIdentityMapping,
  grantMembership,
  grantRelation,
  listIdentityMappings,
  revokeMembership,
  revokeRelation,
} from "../src/lifecycle";
import { getAuthorizationVersion } from "../src/version";
import { createTestDb } from "./helpers";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { Relation, SubjectType } from "../src/types";

let db: LibSQLDatabase<any>;

beforeEach(async () => {
  db = await createTestDb();
});

describe("platform authorization vocabulary", () => {
  it.each([
    "kit:use",
    "kit:act",
    "kit:deploy",
    "kit:telemetry",
    "kit:admin",
    "platform:admin",
  ] as Relation[])("checks the %s relation", async (relation) => {
    const objectType = relation === "platform:admin" ? "platform" : "kit";
    await grantRelation(db, "user-1", relation, objectType, "resource-1");

    await expect(check(db, {
      subjectId: "user-1",
      relation,
      objectType,
      objectId: "resource-1",
    })).resolves.toEqual({ allowed: true });
  });

  it.each([
    "organization",
    "team",
    "role",
    "application",
    "user",
    "service",
    "delegated",
  ] as SubjectType[])("supports %s grant subjects", async (subjectType) => {
    await grantRelation(db, "subject-1", "kit:use", "kit", "debrief", subjectType);

    await expect(check(db, {
      subjectType,
      subjectId: "subject-1",
      relation: "kit:use",
      objectType: "kit",
      objectId: "debrief",
    })).resolves.toEqual({ allowed: true });
  });
});

describe("team and role indirection", () => {
  it("inherits a team grant for a user", async () => {
    await grantRelation(db, "sales-team", "kit:act", "kit", "debrief", "team");
    await grantMembership(db, {
      memberType: "user",
      memberId: "user-1",
      subjectType: "team",
      subjectId: "sales-team",
    });

    await expect(check(db, {
      subjectId: "user-1",
      relation: "kit:act",
      objectType: "kit",
      objectId: "debrief",
    })).resolves.toEqual({ allowed: true });
  });

  it("inherits a role grant for a user", async () => {
    await grantRelation(db, "sales-rep", "kit:use", "kit", "debrief", "role");
    await grantMembership(db, {
      memberType: "user",
      memberId: "user-1",
      subjectType: "role",
      subjectId: "sales-rep",
    });

    await expect(check(db, {
      subjectId: "user-1",
      relation: "kit:use",
      objectType: "kit",
      objectId: "debrief",
    })).resolves.toEqual({ allowed: true });
  });

  it("does not apply a team or role grant without membership", async () => {
    await grantRelation(db, "sales-team", "kit:use", "kit", "debrief", "team");
    await grantRelation(db, "sales-rep", "kit:use", "kit", "debrief", "role");

    await expect(check(db, {
      subjectId: "user-1",
      relation: "kit:use",
      objectType: "kit",
      objectId: "debrief",
    })).resolves.toEqual({ allowed: false });
  });
});

describe("identity claim mappings", () => {
  it("stores and resolves group and app-role mappings by tenant", async () => {
    const groupMapping = {
      provider: "entra",
      tenantId: "tenant-a",
      mappingType: "group" as const,
      claimValue: "sales-group",
      subjectType: "team" as const,
      subjectId: "sales-team",
    };
    const appRoleMapping = {
      provider: "entra",
      tenantId: "tenant-a",
      mappingType: "app-role" as const,
      claimValue: "kit-admin",
      subjectType: "role" as const,
      subjectId: "kit-admin",
    };

    await grantIdentityMapping(db, groupMapping);
    await grantIdentityMapping(db, appRoleMapping);
    await grantIdentityMapping(db, groupMapping);

    await expect(listIdentityMappings(db, "entra", "tenant-a", "group", "sales-group"))
      .resolves.toEqual([{ subjectType: "team", subjectId: "sales-team" }]);
    await expect(listIdentityMappings(db, "entra", "tenant-a", "app-role", "kit-admin"))
      .resolves.toEqual([{ subjectType: "role", subjectId: "kit-admin" }]);
    await expect(listIdentityMappings(db, "entra", "tenant-b", "group", "sales-group"))
      .resolves.toEqual([]);
  });
});

describe("versioned revocation", () => {
  it("advances once for each effective grant or revoke", async () => {
    expect((await getAuthorizationVersion(db)).version).toBe(0);

    await grantRelation(db, "user-1", "kit:use", "kit", "debrief");
    expect((await getAuthorizationVersion(db)).version).toBe(1);

    await grantRelation(db, "user-1", "kit:use", "kit", "debrief");
    expect((await getAuthorizationVersion(db)).version).toBe(1);

    await grantMembership(db, {
      memberType: "user",
      memberId: "user-1",
      subjectType: "team",
      subjectId: "sales-team",
    });
    expect((await getAuthorizationVersion(db)).version).toBe(2);

    await revokeMembership(db, {
      memberType: "user",
      memberId: "user-1",
      subjectType: "team",
      subjectId: "sales-team",
    });
    expect((await getAuthorizationVersion(db)).version).toBe(3);

    await revokeRelation(db, "user-1", "kit:use", "kit", "debrief");
    expect((await getAuthorizationVersion(db)).version).toBe(4);

    await revokeRelation(db, "user-1", "kit:use", "kit", "debrief");
    expect((await getAuthorizationVersion(db)).version).toBe(4);
  });

  it("takes effect immediately after a cached decision is revoked", async () => {
    const cache = new VersionedGrantCache({
      ttlMs: 5 * 60 * 1000,
      now: () => 1_000,
    });
    const input = {
      subjectId: "user-1",
      relation: "kit:use" as const,
      objectType: "kit" as const,
      objectId: "debrief",
    };

    await grantRelation(db, input.subjectId, input.relation, input.objectType, input.objectId);
    await expect(cache.check(db, input)).resolves.toEqual({ allowed: true });

    const startedAt = performance.now();
    await revokeRelation(db, input.subjectId, input.relation, input.objectType, input.objectId);
    await expect(cache.check(db, input)).resolves.toEqual({ allowed: false });
    const revocationLatencyMs = performance.now() - startedAt;

    // This is a local measured SLA guard, not a sleep-based test: version
    // invalidation must beat the one-minute platform requirement.
    expect(revocationLatencyMs).toBeLessThan(60_000);
  });
});
