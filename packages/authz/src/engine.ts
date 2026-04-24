import { eq, and } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { authzTuples } from "./schema";
import type { CheckInput, CheckResult, SubjectType } from "./types";

type DrizzleDb = LibSQLDatabase<any>;

/**
 * Check whether a subject has a specific relation on an object.
 * Single indexed SELECT — microsecond latency on SQLite.
 */
export async function check(db: DrizzleDb, input: CheckInput): Promise<CheckResult> {
  const subjectType = input.subjectType ?? "user";

  const rows = await db
    .select({ id: authzTuples.id })
    .from(authzTuples)
    .where(
      and(
        eq(authzTuples.subjectType, subjectType),
        eq(authzTuples.subjectId, input.subjectId),
        eq(authzTuples.relation, input.relation),
        eq(authzTuples.objectType, input.objectType),
        eq(authzTuples.objectId, input.objectId)
      )
    )
    .limit(1);

  return { allowed: rows.length > 0 };
}

/**
 * List all object IDs where the subject has a given relation on a given object type.
 * e.g. listObjects(db, "user-1", "activator", "kit") → ["crm-kit", "expense-kit"]
 */
export async function listObjects(
  db: DrizzleDb,
  subjectId: string,
  relation: string,
  objectType: string,
  subjectType: SubjectType = "user"
): Promise<string[]> {
  const rows = await db
    .select({ objectId: authzTuples.objectId })
    .from(authzTuples)
    .where(
      and(
        eq(authzTuples.subjectType, subjectType),
        eq(authzTuples.subjectId, subjectId),
        eq(authzTuples.relation, relation),
        eq(authzTuples.objectType, objectType)
      )
    );

  return rows.map((r) => r.objectId);
}

/**
 * List all subject IDs that have a given relation on a specific object.
 * e.g. listSubjects(db, "activator", "kit", "crm-kit") → ["user-1", "user-2"]
 */
export async function listSubjects(
  db: DrizzleDb,
  relation: string,
  objectType: string,
  objectId: string
): Promise<string[]> {
  const rows = await db
    .select({ subjectId: authzTuples.subjectId })
    .from(authzTuples)
    .where(
      and(
        eq(authzTuples.relation, relation),
        eq(authzTuples.objectType, objectType),
        eq(authzTuples.objectId, objectId)
      )
    );

  return rows.map((r) => r.subjectId);
}
