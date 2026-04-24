import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { authzTuples } from "./schema";
import type { SubjectType, Relation, ObjectType } from "./types";

type DrizzleDb = LibSQLDatabase<any>;

/**
 * Write a relationship tuple. Idempotent — does nothing if the tuple already exists.
 */
export async function grantRelation(
  db: DrizzleDb,
  subjectId: string,
  relation: Relation,
  objectType: ObjectType,
  objectId: string,
  subjectType: SubjectType = "user"
): Promise<void> {
  await db
    .insert(authzTuples)
    .values({
      id: nanoid(),
      subjectType,
      subjectId,
      relation,
      objectType,
      objectId,
    })
    .onConflictDoNothing();
}

/**
 * Delete a specific relationship tuple.
 */
export async function revokeRelation(
  db: DrizzleDb,
  subjectId: string,
  relation: Relation,
  objectType: ObjectType,
  objectId: string,
  subjectType: SubjectType = "user"
): Promise<void> {
  await db
    .delete(authzTuples)
    .where(
      and(
        eq(authzTuples.subjectType, subjectType),
        eq(authzTuples.subjectId, subjectId),
        eq(authzTuples.relation, relation),
        eq(authzTuples.objectType, objectType),
        eq(authzTuples.objectId, objectId)
      )
    );
}

/**
 * Revoke all tuples for a given subject (e.g. when deleting a user).
 */
export async function revokeAllForSubject(
  db: DrizzleDb,
  subjectId: string,
  subjectType: SubjectType = "user"
): Promise<void> {
  await db
    .delete(authzTuples)
    .where(
      and(
        eq(authzTuples.subjectType, subjectType),
        eq(authzTuples.subjectId, subjectId)
      )
    );
}
