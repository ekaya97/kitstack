import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { subscriptions, type Subscription } from "@/db/schema";

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const results = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    )
    .limit(1);
  return results[0] ?? null;
}

export async function createSubscription(
  userId: string,
  plan: "starter" | "pro"
): Promise<Subscription> {
  // Check for existing active subscription
  const existing = await getSubscription(userId);
  if (existing) {
    return existing;
  }

  const id = nanoid();
  const now = new Date();
  // Mock billing: set period end to 30 days from now
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(subscriptions).values({
    id,
    userId,
    plan,
    status: "active",
    currentPeriodEnd: periodEnd,
  });

  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id));
  return result[0];
}

export async function cancelSubscription(userId: string): Promise<void> {
  await db
    .update(subscriptions)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    );
}
