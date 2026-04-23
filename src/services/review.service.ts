import { db } from "@/lib/db";
import { reviews, reviewHelpful, skills, kits } from "@/db/schema";
import { eq, and, sql, avg, count } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function getReviewsByTarget(targetType: string, targetSlug: string) {
  const allReviews = await db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.targetType, targetType as "skill" | "kit"),
        eq(reviews.targetSlug, targetSlug),
      ),
    )
    .orderBy(sql`${reviews.createdAt} desc`);

  const reviewsWithHelpful = await Promise.all(
    allReviews.map(async (review) => {
      const helpfulCount = await getHelpfulCount(review.id);
      return { ...review, helpfulCount };
    }),
  );

  return reviewsWithHelpful;
}

export async function getRatingDistribution(targetType: string, targetSlug: string) {
  const rows = await db
    .select({
      rating: reviews.rating,
      count: count(),
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.targetType, targetType as "skill" | "kit"),
        eq(reviews.targetSlug, targetSlug),
      ),
    )
    .groupBy(reviews.rating);

  const total = rows.reduce((sum, r) => sum + r.count, 0);

  const distribution: { stars: number; count: number; pct: number }[] = [];
  for (let stars = 5; stars >= 1; stars--) {
    const row = rows.find((r) => r.rating === stars);
    const cnt = row?.count || 0;
    distribution.push({
      stars,
      count: cnt,
      pct: total > 0 ? Math.round((cnt / total) * 100) : 0,
    });
  }

  return distribution;
}

export async function createReview(data: {
  targetType: string;
  targetSlug: string;
  userId: string;
  userName: string;
  userRole?: string;
  rating: number;
  text: string;
}) {
  await db.insert(reviews).values({
    id: nanoid(),
    targetType: data.targetType as "skill" | "kit",
    targetSlug: data.targetSlug,
    userId: data.userId,
    userName: data.userName,
    userRole: data.userRole ?? null,
    rating: data.rating,
    text: data.text,
  });

  await recalculateRatings(data.targetType, data.targetSlug);
}

export async function toggleHelpful(reviewId: string, userId: string) {
  const existing = await db
    .select()
    .from(reviewHelpful)
    .where(
      and(
        eq(reviewHelpful.reviewId, reviewId),
        eq(reviewHelpful.userId, userId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(reviewHelpful)
      .where(
        and(
          eq(reviewHelpful.reviewId, reviewId),
          eq(reviewHelpful.userId, userId),
        ),
      );
  } else {
    await db.insert(reviewHelpful).values({
      id: nanoid(),
      reviewId,
      userId,
    });
  }
}

export async function getHelpfulCount(reviewId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(reviewHelpful)
    .where(eq(reviewHelpful.reviewId, reviewId));

  return result[0]?.count || 0;
}

export async function recalculateRatings(targetType: string, targetSlug: string) {
  const result = await db
    .select({
      avgRating: avg(reviews.rating),
      reviewCount: count(),
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.targetType, targetType as "skill" | "kit"),
        eq(reviews.targetSlug, targetSlug),
      ),
    );

  const avgRating = result[0]?.avgRating ? parseFloat(result[0].avgRating) : 0;
  const reviewCount = result[0]?.reviewCount || 0;

  if (targetType === "skill") {
    await db
      .update(skills)
      .set({ avgRating, reviewCount })
      .where(eq(skills.slug, targetSlug));
  } else {
    await db
      .update(kits)
      .set({ avgRating, reviewCount })
      .where(eq(kits.slug, targetSlug));
  }
}
