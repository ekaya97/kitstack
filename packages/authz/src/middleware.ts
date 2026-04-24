import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { check } from "./engine";
import type { AuthzContext, AuthzRequirement, CheckResult } from "./types";

type DrizzleDb = LibSQLDatabase<any>;

export interface AuthorizeResult {
  allowed: boolean;
  failedCheck?: AuthzRequirement;
  reason?: string;
}

/**
 * Context-agnostic authorization function.
 * Checks all requirements against the tuple store.
 * If requirements is empty, only authentication is required (always passes).
 */
export async function authorize(
  db: DrizzleDb,
  ctx: AuthzContext,
  requirements: AuthzRequirement[]
): Promise<AuthorizeResult> {
  for (const req of requirements) {
    const result: CheckResult = await check(db, {
      subjectId: ctx.userId,
      relation: req.relation,
      objectType: req.objectType,
      objectId: req.objectId,
    });

    if (!result.allowed) {
      return {
        allowed: false,
        failedCheck: req,
        reason: result.reason ?? `Missing ${req.relation} on ${req.objectType}:${req.objectId}`,
      };
    }
  }

  return { allowed: true };
}
