import { z } from "zod";
import { eq, like } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import type { KitResultFragment } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { content, ideas, topics } from "../schema";

export const createContent = defineTool({
  name: "create_content",
  description:
    "Create a content piece — a draft post, article, newsletter, or thread. Optionally link to an existing idea. TRIGGER: user wants to write, draft, or create a post/article.",
  args: z.object({
    title: z.string().describe("Content title"),
    channel: z
      .enum(["linkedin", "blog", "newsletter", "twitter", "instagram", "other"])
      .describe("Publishing channel"),
    format: z
      .enum(["post", "article", "carousel", "thread", "video_script", "newsletter"])
      .optional()
      .describe("Content format"),
    body: z.string().optional().describe("Draft text or outline"),
    idea_id: z.string().optional().describe("Link to an existing idea (idea_xxx)"),
    idea: z.string().optional().describe("Idea title for fuzzy match"),
    scheduled_date: z.string().optional().describe("When to publish (YYYY-MM-DD)"),
    topic: z.string().optional().describe("Topic area"),
    tags: z.string().optional().describe("Comma-separated tags"),
    notes: z.string().optional().describe("Additional notes or context"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();
    const fragments: KitResultFragment[] = [];

    // Resolve idea reference
    let ideaId: string | null = null;
    if (args.idea_id) {
      ideaId = args.idea_id;
    } else if (args.idea) {
      const matches = await db
        .select()
        .from(ideas)
        .where(like(ideas.title, `%${args.idea}%`))
        .limit(5);
      if (matches.length === 1) {
        ideaId = matches[0].id;
      } else if (matches.length > 1) {
        const list = matches.map((i) => `• ${i.title} (${i.id})`).join("\n");
        return kit.text(`Multiple ideas match. Please specify:\n${list}`);
      }
    }

    // Mark linked idea as "developing" if it was "captured"
    if (ideaId) {
      const linked = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
      if (linked.length > 0 && linked[0].status === "captured") {
        await db
          .update(ideas)
          .set({ status: "developing", updatedAt: now })
          .where(eq(ideas.id, ideaId));
        fragments.push(kit.updated(ideaId, "idea", `Idea moved to "developing".`));
      }
    }

    // Ensure topic exists
    if (args.topic) {
      const existing = await db
        .select()
        .from(topics)
        .where(like(topics.name, args.topic))
        .limit(1);
      if (existing.length === 0) {
        const topicId = `top_${nanoid()}`;
        await db.insert(topics).values({
          id: topicId,
          name: args.topic,
          contentCount: 1,
          lastUsedAt: now,
          createdAt: now,
        });
        fragments.push(kit.created(topicId, "topic", `Topic "${args.topic}" added.`));
      } else {
        await db
          .update(topics)
          .set({
            contentCount: (existing[0].contentCount ?? 0) + 1,
            lastUsedAt: now,
          })
          .where(eq(topics.id, existing[0].id));
      }
    }

    const contentId = `cnt_${nanoid()}`;
    const status = args.scheduled_date ? "scheduled" : "draft";

    await db.insert(content).values({
      id: contentId,
      ideaId,
      title: args.title,
      body: args.body ?? null,
      channel: args.channel,
      format: args.format ?? null,
      status,
      scheduledDate: args.scheduled_date ?? null,
      publishedDate: null,
      publishedUrl: null,
      notes: args.notes ?? null,
      tags: args.tags ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const statusNote = status === "scheduled" ? ` — scheduled for ${args.scheduled_date}` : "";
    fragments.push(kit.created(contentId, "content", `Content "${args.title}" created${statusNote}.`));
    return kit.result(fragments);
  },
});
