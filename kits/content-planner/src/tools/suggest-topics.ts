import { z } from "zod";
import { asc, desc, sql, eq, isNull } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { topics, content, performance } from "../schema";

export const suggestTopics = defineTool({
  name: "suggest_topics",
  description:
    "Suggest topics to write about — prioritizes topics not covered recently and topics with historically high engagement. TRIGGER: user asks for content ideas or what to write about.",
  args: z.object({
    count: z.number().optional().default(5).describe("Number of suggestions to return"),
  }),
  handler: async (db, args) => {
    // Get all topics sorted by last used (oldest first = most overdue)
    const allTopics = await db.select().from(topics).orderBy(asc(topics.lastUsedAt));

    if (allTopics.length === 0) {
      return kit.text(
        "No topics tracked yet. Start by capturing ideas or creating content with topics to build your topic library."
      );
    }

    // Get performance by topic
    const topicPerf = await db
      .select({
        topic: content.tags, // we'll match via tags or content topic
        totalEngagements: sql<number>`coalesce(sum(${performance.engagements}), 0)`,
        totalImpressions: sql<number>`coalesce(sum(${performance.impressions}), 0)`,
        pieceCount: sql<number>`count(distinct ${content.id})`,
      })
      .from(content)
      .leftJoin(performance, eq(content.id, performance.contentId))
      .where(isNull(content.archivedAt))
      .groupBy(content.tags);

    // Score each topic: days since last use + engagement bonus
    const now = new Date();
    const scored = allTopics.map((t) => {
      const daysSince = t.lastUsedAt
        ? Math.floor((now.getTime() - new Date(t.lastUsedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Find matching performance data
      const perf = topicPerf.find(
        (p) => p.topic && p.topic.toLowerCase().includes(t.name.toLowerCase())
      );
      const engagementScore = perf ? perf.totalEngagements : 0;

      return {
        ...t,
        daysSince,
        engagementScore,
        score: daysSince + Math.min(engagementScore / 10, 100), // balance recency and performance
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const suggestions = scored.slice(0, args.count);

    let text = `**${suggestions.length} topic suggestions:**\n\n`;
    for (const s of suggestions) {
      const reason =
        s.daysSince > 90
          ? "hasn't been covered in 3+ months"
          : s.daysSince > 30
            ? `last covered ${s.daysSince} days ago`
            : s.engagementScore > 0
              ? `high past engagement (${s.engagementScore} total)`
              : `${s.contentCount ?? 0} piece(s) so far`;
      text += `• **${s.name}** — ${reason}${s.description ? `. ${s.description}` : ""}\n`;
    }

    return kit.text(text);
  },
});
