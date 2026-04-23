import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kitActivations } from "@/db/schema";

export const PLAN_LIMITS = {
  starter: 2,
  pro: Infinity,
} as const;

export async function getActiveKitCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(kitActivations)
    .where(
      and(
        eq(kitActivations.userId, userId),
        eq(kitActivations.status, "active")
      )
    );
  return result[0]?.count ?? 0;
}

export async function canActivateKit(
  userId: string,
  plan: string
): Promise<{ allowed: boolean; activeCount: number; limit: number }> {
  const limit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? 0;
  const activeCount = await getActiveKitCount(userId);
  return { allowed: activeCount < limit, activeCount, limit };
}

export async function deactivateKit(
  userId: string,
  kitSlug: string
): Promise<boolean> {
  const result = await db
    .update(kitActivations)
    .set({
      status: "deactivated",
      deactivatedAt: new Date(),
    })
    .where(
      and(
        eq(kitActivations.userId, userId),
        eq(kitActivations.kitSlug, kitSlug),
        eq(kitActivations.status, "active")
      )
    );
  return true;
}

export async function reactivateKit(
  userId: string,
  kitSlug: string
): Promise<boolean> {
  await db
    .update(kitActivations)
    .set({
      status: "active",
      deactivatedAt: null,
    })
    .where(
      and(
        eq(kitActivations.userId, userId),
        eq(kitActivations.kitSlug, kitSlug)
      )
    );
  return true;
}
