import { defineLoader } from "@kitstackco/sdk";
import { eq, isNull, and, gte, desc, sql, inArray } from "drizzle-orm";
import { content, performance } from "../../schema";

export const loader = defineLoader(async (db) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;

  // Overall stats
  const [totals] = await db
    .select({
      published: sql<number>`count(*)`,
      impressions: sql<number>`coalesce(sum(${performance.impressions}), 0)`,
      engagements: sql<number>`coalesce(sum(${performance.engagements}), 0)`,
      clicks: sql<number>`coalesce(sum(${performance.clicks}), 0)`,
    })
    .from(content)
    .leftJoin(performance, eq(content.id, performance.contentId))
    .where(and(isNull(content.archivedAt), inArray(content.status, ["published", "repurposed"])));

  // Top performers
  const topContent = await db
    .select({
      id: content.id,
      title: content.title,
      channel: content.channel,
      publishedDate: content.publishedDate,
      impressions: sql<number>`coalesce(sum(${performance.impressions}), 0)`,
      engagements: sql<number>`coalesce(sum(${performance.engagements}), 0)`,
      clicks: sql<number>`coalesce(sum(${performance.clicks}), 0)`,
    })
    .from(content)
    .leftJoin(performance, eq(content.id, performance.contentId))
    .where(and(isNull(content.archivedAt), inArray(content.status, ["published", "repurposed"])))
    .groupBy(content.id)
    .orderBy(desc(sql`coalesce(sum(${performance.engagements}), 0)`))
    .limit(10);

  // Channel breakdown
  const byChannel = await db
    .select({
      channel: content.channel,
      count: sql<number>`count(distinct ${content.id})`,
      impressions: sql<number>`coalesce(sum(${performance.impressions}), 0)`,
      engagements: sql<number>`coalesce(sum(${performance.engagements}), 0)`,
    })
    .from(content)
    .leftJoin(performance, eq(content.id, performance.contentId))
    .where(and(isNull(content.archivedAt), inArray(content.status, ["published", "repurposed"])))
    .groupBy(content.channel)
    .orderBy(desc(sql`coalesce(sum(${performance.engagements}), 0)`));

  // Monthly trend (last 6 months)
  const trend: { month: string; published: number; engagements: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const tm = new Date(y, m - i, 1);
    const tStart = `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, "0")}-01`;
    const tEnd = `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, "0")}-${new Date(tm.getFullYear(), tm.getMonth() + 1, 0).getDate()}`;

    const [row] = await db
      .select({
        published: sql<number>`count(distinct ${content.id})`,
        engagements: sql<number>`coalesce(sum(${performance.engagements}), 0)`,
      })
      .from(content)
      .leftJoin(performance, eq(content.id, performance.contentId))
      .where(
        and(
          isNull(content.archivedAt),
          inArray(content.status, ["published", "repurposed"]),
          gte(content.publishedDate, tStart),
          sql`${content.publishedDate} <= ${tEnd}`
        )
      );

    trend.push({
      month: tm.toLocaleString("en", { month: "short" }),
      published: row.published,
      engagements: row.engagements,
    });
  }

  return { totals, topContent, byChannel, trend };
});
