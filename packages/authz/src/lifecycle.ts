import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { authzIdentityMappings, authzMemberships, authzTuples } from "./schema";
import { bumpAuthorizationVersion } from "./version";
import type {
  IdentityMapping,
  SubjectMembership,
  SubjectType,
  Relation,
  ObjectType,
} from "./types";

type DrizzleDb = LibSQLDatabase<any>;

/** Write a relationship tuple. Idempotent and versioned when inserted. */
export async function grantRelation(
  db: DrizzleDb,
  subjectId: string,
  relation: Relation,
  objectType: ObjectType,
  objectId: string,
  subjectType: SubjectType = "user"
): Promise<void> {
  const inserted = await db
    .insert(authzTuples)
    .values({
      id: nanoid(),
      subjectType,
      subjectId,
      relation,
      objectType,
      objectId,
    })
    .onConflictDoNothing()
    .returning({ id: authzTuples.id });

  if (inserted.length > 0) {
    await bumpAuthorizationVersion(db);
  }
}

/** Delete a specific relationship tuple and advance the version if it existed. */
export async function revokeRelation(
  db: DrizzleDb,
  subjectId: string,
  relation: Relation,
  objectType: ObjectType,
  objectId: string,
  subjectType: SubjectType = "user"
): Promise<void> {
  const deleted = await db
    .delete(authzTuples)
    .where(
      and(
        eq(authzTuples.subjectType, subjectType),
        eq(authzTuples.subjectId, subjectId),
        eq(authzTuples.relation, relation),
        eq(authzTuples.objectType, objectType),
        eq(authzTuples.objectId, objectId)
      )
    )
    .returning({ id: authzTuples.id });

  if (deleted.length > 0) {
    await bumpAuthorizationVersion(db);
  }
}

/** Revoke all tuples for a given subject (e.g. when deleting a user). */
export async function revokeAllForSubject(
  db: DrizzleDb,
  subjectId: string,
  subjectType: SubjectType = "user"
): Promise<void> {
  const deleted = await db
    .delete(authzTuples)
    .where(
      and(
        eq(authzTuples.subjectType, subjectType),
        eq(authzTuples.subjectId, subjectId)
      )
    )
    .returning({ id: authzTuples.id });

  if (deleted.length > 0) {
    await bumpAuthorizationVersion(db);
  }
}

function validateMembership(membership: SubjectMembership): void {
  if (membership.subjectType !== "team" && membership.subjectType !== "role") {
    throw new Error("Membership targets must be a team or role");
  }
}

/** Add a user or service to a team/role. Membership is intentionally one-hop. */
export async function grantMembership(
  db: DrizzleDb,
  membership: SubjectMembership
): Promise<void> {
  validateMembership(membership);

  const inserted = await db
    .insert(authzMemberships)
    .values({ id: nanoid(), ...membership })
    .onConflictDoNothing()
    .returning({ id: authzMemberships.id });

  if (inserted.length > 0) {
    await bumpAuthorizationVersion(db);
  }
}

/** Remove one team/role membership and invalidate cached decisions. */
export async function revokeMembership(
  db: DrizzleDb,
  membership: SubjectMembership
): Promise<void> {
  validateMembership(membership);

  const deleted = await db
    .delete(authzMemberships)
    .where(
      and(
        eq(authzMemberships.memberType, membership.memberType),
        eq(authzMemberships.memberId, membership.memberId),
        eq(authzMemberships.subjectType, membership.subjectType),
        eq(authzMemberships.subjectId, membership.subjectId)
      )
    )
    .returning({ id: authzMemberships.id });

  if (deleted.length > 0) {
    await bumpAuthorizationVersion(db);
  }
}

/** Remove every team/role membership for a member. */
export async function revokeAllMembershipsForMember(
  db: DrizzleDb,
  memberId: string,
  memberType: SubjectType
): Promise<void> {
  const deleted = await db
    .delete(authzMemberships)
    .where(
      and(
        eq(authzMemberships.memberType, memberType),
        eq(authzMemberships.memberId, memberId)
      )
    )
    .returning({ id: authzMemberships.id });

  if (deleted.length > 0) {
    await bumpAuthorizationVersion(db);
  }
}

/** Map one provider group or app-role claim to a grant subject. */
export async function grantIdentityMapping(
  db: DrizzleDb,
  mapping: IdentityMapping
): Promise<void> {
  const inserted = await db
    .insert(authzIdentityMappings)
    .values({ id: nanoid(), ...mapping })
    .onConflictDoNothing()
    .returning({ id: authzIdentityMappings.id });

  if (inserted.length > 0) {
    await bumpAuthorizationVersion(db);
  }
}

/** Remove one provider claim mapping. */
export async function revokeIdentityMapping(
  db: DrizzleDb,
  mapping: IdentityMapping
): Promise<void> {
  const deleted = await db
    .delete(authzIdentityMappings)
    .where(
      and(
        eq(authzIdentityMappings.provider, mapping.provider),
        eq(authzIdentityMappings.tenantId, mapping.tenantId),
        eq(authzIdentityMappings.mappingType, mapping.mappingType),
        eq(authzIdentityMappings.claimValue, mapping.claimValue),
        eq(authzIdentityMappings.subjectType, mapping.subjectType),
        eq(authzIdentityMappings.subjectId, mapping.subjectId)
      )
    )
    .returning({ id: authzIdentityMappings.id });

  if (deleted.length > 0) {
    await bumpAuthorizationVersion(db);
  }
}

/** Resolve all grant subjects mapped from a provider claim. */
export async function listIdentityMappings(
  db: DrizzleDb,
  provider: string,
  tenantId: string,
  mappingType: IdentityMapping["mappingType"],
  claimValue: string
): Promise<Array<Pick<IdentityMapping, "subjectType" | "subjectId">>> {
  const rows = await db
    .select({
      subjectType: authzIdentityMappings.subjectType,
      subjectId: authzIdentityMappings.subjectId,
    })
    .from(authzIdentityMappings)
    .where(
      and(
        eq(authzIdentityMappings.provider, provider),
        eq(authzIdentityMappings.tenantId, tenantId),
        eq(authzIdentityMappings.mappingType, mappingType),
        eq(authzIdentityMappings.claimValue, claimValue)
      )
    );

  return rows as Array<Pick<IdentityMapping, "subjectType" | "subjectId">>;
}
