import { z } from "zod";
import { eq, isNull, and, gte, lte, desc, sql, SQL } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { content, performance } from "../schema";

export const performanceReport = defineTool({
  name: "performance_report",
  description:
    "Performance summary across published content — total impressions, engagements, top performers. TRIGGER: user asks about content analytics, results, or performance.",
  args: z.object({
    period: z
      .enum(["this_week", "this_month", "last_month", "this_year", "all_time"])
      .optional()
      .default("this_month")
      .describe("Time period to report on"),
    channel: z
      .enum(["linkedin", "blog", "newsletter", "twitter", "instagram", "other"])
      .optional()
      .describe("Filter by channel"),
  }),
  handler: async (db, args) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    let dateStart = "2000-01-01";
    let dateEnd = now.toISOString().split("T")[0];
    let periodLabel = "All time";

    switch (args.period) {
      case "this_week": {
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
        dateStart = monday.toISOString().split("T")[0];
        periodLabel = "This week";
        break;
      }
      case "this_month":
        dateStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        periodLabel = "This month";
        break;
      case "last_month": {
        const lm = m === 0 ? 11 : m - 1;
        const ly = m === 0 ? y - 1 : y;
        const lastDay = new Date(ly, lm + 1, 0).getDate();
        dateStart = `${ly}-${String(lm + 1).padStart(2, "0")}-01`;
        dateEnd = `${ly}-${String(lm + 1).padStart(2, "0")}-${lastDay}`;
        periodLabel = "Last month";
        break;
      }
      case "this_year":
        dateStart = `${y}-01-01`;
        periodLabel = `${y}`;
        break;
    }

    // Get published content with aggregated performance
    const contentConditions: SQL[] = [
      isNull(content.archivedAt),
      eq(content.status, "published"),
    ];
    if (args.channel) contentConditions.push(eq(content.channel, args.channel));

    const rows = await db
      .select({
        contentId: content.id,
        title: content.title,
        channel: content.channel,
        publishedDate: content.publishedDate,
        impressions: sql<number>`coalesce(sum(${performance.impressions}), 0)`,
        engagements: sql<number>`coalesce(sum(${performance.engagements}), 0)`,
        likes: sql<number>`coalesce(sum(${performance.likes}), 0)`,
        comments: sql<number>`coalesce(sum(${performance.comments}), 0)`,
        shares: sql<number>`coalesce(sum(${performance.shares}), 0)`,
        clicks: sql<number>`coalesce(sum(${performance.clicks}), 0)`,
      })
      .from(content)
      .leftJoin(performance, eq(content.id, performance.contentId))
      .where(and(...contentConditions))
      .groupBy(content.id)
      .having(gte(content.publishedDate, dateStart))
      .orderBy(desc(sql`coalesce(sum(${performance.engagements}), 0)`));

    if (rows.length === 0) return kit.text(`No published content with performance data for ${periodLabel}.`);

    // Top-line metrics
    const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
    const totalEngagements = rows.reduce((s, r) => s + r.engagements, 0);
    const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
    const avgEngRate = totalImpressions > 0 ? ((totalEngagements / totalImpressions) * 100).toFixed(1) : "—";

    let text = `**Performance Report — ${periodLabel}**${args.channel ? ` (${args.channel})` : ""}\n\n`;
    text += `| Metric | Value |\n|--------|-------|\n`;
    text += `| Pieces published | ${rows.length} |\n`;
    text += `| Total impressions | ${totalImpressions.toLocaleString()} |\n`;
    text += `| Total engagements | ${totalEngagements.toLocaleString()} |\n`;
    text += `| Avg. engagement rate | ${avgEngRate}% |\n`;
    text += `| Total clicks | ${totalClicks.toLocaleString()} |\n`;

    text += `\n**Top content by engagement:**\n\n`;
    text += `| Title | Channel | Impressions | Engagements | Clicks |\n|-------|---------|-------------|-------------|--------|\n`;
    for (const r of rows.slice(0, 10)) {
      text += `| ${r.title} | ${r.channel} | ${r.impressions.toLocaleString()} | ${r.engagements.toLocaleString()} | ${r.clicks.toLocaleString()} |\n`;
    }

    return kit.text(text);
  },
});
