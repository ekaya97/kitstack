import { db } from "@/lib/db";
import { wishlists } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function addToWishlist(
  userId: string,
  targetType: string,
  targetSlug: string,
) {
  await db
    .insert(wishlists)
    .values({
      id: nanoid(),
      userId,
      targetType: targetType as "skill" | "kit",
      targetSlug,
    })
    .onConflictDoNothing();
}

export async function removeFromWishlist(
  userId: string,
  targetType: string,
  targetSlug: string,
) {
  await db
    .delete(wishlists)
    .where(
      and(
        eq(wishlists.userId, userId),
        eq(wishlists.targetType, targetType as "skill" | "kit"),
        eq(wishlists.targetSlug, targetSlug),
      ),
    );
}

export async function isWishlisted(
  userId: string,
  targetType: string,
  targetSlug: string,
): Promise<boolean> {
  const result = await db
    .select()
    .from(wishlists)
    .where(
      and(
        eq(wishlists.userId, userId),
        eq(wishlists.targetType, targetType as "skill" | "kit"),
        eq(wishlists.targetSlug, targetSlug),
      ),
    )
    .limit(1);

  return result.length > 0;
}

export async function getUserWishlist(userId: string) {
  return db
    .select()
    .from(wishlists)
    .where(eq(wishlists.userId, userId))
    .orderBy(wishlists.createdAt);
}
