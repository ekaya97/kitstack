export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reviews, reviewHelpful } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { desc, eq, sql, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("targetType");
  const verified = searchParams.get("verified");

  const conditions = [];

  if (targetType === "skill" || targetType === "kit") {
    conditions.push(eq(reviews.targetType, targetType));
  }

  if (verified === "true") {
    conditions.push(eq(reviews.verified, true));
  } else if (verified === "false") {
    conditions.push(eq(reviews.verified, false));
  }

  const helpfulCountSq = db
    .select({
      reviewId: reviewHelpful.reviewId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(reviewHelpful)
    .groupBy(reviewHelpful.reviewId)
    .as("helpful_counts");

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: reviews.id,
      targetType: reviews.targetType,
      targetSlug: reviews.targetSlug,
      userId: reviews.userId,
      userName: reviews.userName,
      userRole: reviews.userRole,
      rating: reviews.rating,
      text: reviews.text,
      verified: reviews.verified,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      helpfulCount: sql<number>`coalesce(${helpfulCountSq.count}, 0)`,
    })
    .from(reviews)
    .leftJoin(helpfulCountSq, eq(reviews.id, helpfulCountSq.reviewId))
    .where(where)
    .orderBy(desc(reviews.createdAt));

  return NextResponse.json({ reviews: rows });
}
