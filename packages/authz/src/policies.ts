import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { listObjects } from "./engine";
import type { CheckResult } from "./types";

type DrizzleDb = LibSQLDatabase<any>;

const PLAN_LIMITS: Record<string, number> = {
  starter: 2,
  pro: Infinity,
};

/**
 * Check whether a user can activate a new kit.
 * Combines a tuple lookup (has any subscription?) with a count-based plan limit check.
 *
 * @param plan - The user's current subscription plan name (e.g. "starter", "pro")
 */
export async function canActivateKit(
  db: DrizzleDb,
  userId: string,
  plan: string
): Promise<CheckResult> {
  const limit = PLAN_LIMITS[plan] ?? 0;
  const activeKits = await listObjects(db, userId, "activator", "kit");

  if (activeKits.length >= limit) {
    return {
      allowed: false,
      reason: `Your ${plan} plan allows ${limit} active kit${limit !== 1 ? "s" : ""}. You have ${activeKits.length} active. Deactivate one first.`,
    };
  }

  return { allowed: true };
}
