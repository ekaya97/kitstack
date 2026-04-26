import { NextResponse } from "next/server";
import { sql, eq, desc, count } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  skills,
  kits,
  subscriptions,
  kitActivations,
  skillDownloads,
  reviews,
} from "@/db/schema";
import { user } from "@/db/auth-schema";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Run all queries in parallel
  const [
    usersResult,
    adminCount,
    skillsResult,
    kitsResult,
    activeSubsResult,
    totalSubsResult,
    activeActivationsResult,
    totalActivationsResult,
    totalDownloadsResult,
    reviewsResult,
    unverifiedReviewsResult,
    topSkillsByDownloads,
    topKitsByActivations,
    recentActivations,
    recentDownloads,
    recentUsers,
    recentReviews,
    categoryCounts,
    subscriptionBreakdown,
  ] = await Promise.all([
    // Total users
    db.select({ count: count() }).from(user),
    // Admin users
    db.select({ count: count() }).from(user).where(eq(user.role, "admin")),
    // Total skills
    db.select({ count: count() }).from(skills),
    // Total kits
    db.select({ count: count() }).from(kits),
    // Active subscriptions
    db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
    // Total subscriptions ever
    db.select({ count: count() }).from(subscriptions),
    // Active kit activations
    db.select({ count: count() }).from(kitActivations).where(eq(kitActivations.status, "active")),
    // Total kit activations
    db.select({ count: count() }).from(kitActivations),
    // Total downloads (sum of downloadCount on skills)
    db.select({ total: sql<number>`coalesce(sum(${skills.downloadCount}), 0)` }).from(skills),
    // Total reviews
    db.select({ count: count() }).from(reviews),
    // Unverified reviews
    db.select({ count: count() }).from(reviews).where(eq(reviews.verified, false)),
    // Top 5 skills by downloads
    db
      .select({ slug: skills.slug, name: skills.name, category: skills.category, downloads: skills.downloadCount })
      .from(skills)
      .orderBy(desc(skills.downloadCount))
      .limit(5),
    // Top 5 kits by activations (count from kitActivations)
    db
      .select({
        slug: kits.slug,
        name: kits.name,
        category: kits.category,
        activations: sql<number>`(select count(*) from kit_activations where kit_slug = ${kits.slug} and status = 'active')`,
      })
      .from(kits)
      .orderBy(
        sql`(select count(*) from kit_activations where kit_slug = ${kits.slug} and status = 'active') desc`,
      )
      .limit(5),
    // Recent kit activations (last 10)
    db
      .select({
        id: kitActivations.id,
        userId: kitActivations.userId,
        kitSlug: kitActivations.kitSlug,
        status: kitActivations.status,
        createdAt: kitActivations.createdAt,
      })
      .from(kitActivations)
      .orderBy(desc(kitActivations.createdAt))
      .limit(10),
    // Recent skill downloads (last 10)
    db
      .select({
        id: skillDownloads.id,
        userId: skillDownloads.userId,
        skillSlug: skillDownloads.skillSlug,
        createdAt: skillDownloads.createdAt,
      })
      .from(skillDownloads)
      .orderBy(desc(skillDownloads.createdAt))
      .limit(10),
    // Recent users (last 5)
    db
      .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(5),
    // Recent reviews (last 5)
    db
      .select({
        id: reviews.id,
        targetType: reviews.targetType,
        targetSlug: reviews.targetSlug,
        userName: reviews.userName,
        rating: reviews.rating,
        verified: reviews.verified,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .orderBy(desc(reviews.createdAt))
      .limit(5),
    // Skills per category
    db
      .select({ category: skills.category, count: count() })
      .from(skills)
      .groupBy(skills.category),
    // Subscription breakdown by plan+status
    db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        count: count(),
      })
      .from(subscriptions)
      .groupBy(subscriptions.plan, subscriptions.status),
  ]);

  return NextResponse.json({
    counts: {
      users: usersResult[0].count,
      admins: adminCount[0].count,
      skills: skillsResult[0].count,
      kits: kitsResult[0].count,
      activeSubscriptions: activeSubsResult[0].count,
      totalSubscriptions: totalSubsResult[0].count,
      activeActivations: activeActivationsResult[0].count,
      totalActivations: totalActivationsResult[0].count,
      totalDownloads: totalDownloadsResult[0].total,
      reviews: reviewsResult[0].count,
      unverifiedReviews: unverifiedReviewsResult[0].count,
    },
    topSkills: topSkillsByDownloads,
    topKits: topKitsByActivations,
    recentActivations,
    recentDownloads,
    recentUsers,
    recentReviews,
    categoryCounts,
    subscriptionBreakdown,
  });
}
