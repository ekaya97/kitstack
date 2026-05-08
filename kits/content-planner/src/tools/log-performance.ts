import { z } from "zod";
import { eq, like } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { performance, content } from "../schema";

export const logPerformance = defineTool({
  name: "log_performance",
  description:
    "Record performance metrics for published content — impressions, likes, comments, shares, clicks. TRIGGER: user reports how a post performed or shares analytics.",
  args: z.object({
    content: z.string().describe("Content ID (cnt_xxx) or title for fuzzy match"),
    impressions: z.number().optional().describe("Number of impressions/views"),
    engagements: z.number().optional().describe("Total engagements (likes+comments+shares combined)"),
    likes: z.number().optional().describe("Number of likes/reactions"),
    comments: z.number().optional().describe("Number of comments"),
    shares: z.number().optional().describe("Number of shares/reposts"),
    clicks: z.number().optional().describe("Number of link clicks"),
    notes: z.string().optional().describe("Qualitative observations"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();

    // Resolve content
    let contentId: string;
    if (args.content.startsWith("cnt_")) {
      const exists = await db
        .select({ id: content.id })
        .from(content)
        .where(eq(content.id, args.content))
        .limit(1);
      if (exists.length === 0) return kit.error(`Content "${args.content}" not found.`);
      contentId = args.content;
    } else {
      const matches = await db
        .select({ id: content.id, title: content.title })
        .from(content)
        .where(like(content.title, `%${args.content}%`))
        .limit(5);

      if (matches.length === 0) return kit.error(`No content found matching "${args.content}".`);
      if (matches.length > 1) {
        const list = matches.map((c) => `• ${c.title} (${c.id})`).join("\n");
        return kit.text(`Multiple pieces match. Please specify:\n${list}`);
      }
      contentId = matches[0].id;
    }

    // Auto-calculate engagements if not provided
    const engagements =
      args.engagements ?? (args.likes ?? 0) + (args.comments ?? 0) + (args.shares ?? 0);

    const perfId = `perf_${nanoid()}`;
    await db.insert(performance).values({
      id: perfId,
      contentId,
      impressions: args.impressions ?? null,
      engagements,
      likes: args.likes ?? null,
      comments: args.comments ?? null,
      shares: args.shares ?? null,
      clicks: args.clicks ?? null,
      notes: args.notes ?? null,
      recordedAt: now,
      createdAt: now,
    });

    const metrics: string[] = [];
    if (args.impressions) metrics.push(`${args.impressions.toLocaleString()} impressions`);
    if (engagements) metrics.push(`${engagements} engagements`);
    if (args.clicks) metrics.push(`${args.clicks} clicks`);

    return kit.result(
      kit.created(perfId, "performance", `Performance logged: ${metrics.join(", ") || "recorded"}.`)
    );
  },
});
