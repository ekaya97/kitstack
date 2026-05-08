import { z } from "zod";
import { eq, like } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import type { KitResultFragment } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { ideas, topics } from "../schema";

export const captureIdea = defineTool({
  name: "capture_idea",
  description:
    "Save a content idea for later development. TRIGGER: user mentions a content idea, says 'I should write about…', or wants to brainstorm topics.",
  args: z.object({
    title: z.string().describe("Short title for the idea"),
    description: z.string().optional().describe("Longer description or notes"),
    topic: z.string().optional().describe("Broad topic area (e.g. AI, marketing, freelancing)"),
    target_channel: z
      .enum(["linkedin", "blog", "newsletter", "twitter", "instagram", "other"])
      .optional()
      .describe("Where this idea would be published"),
    inspiration: z.string().optional().describe("Where the idea came from"),
    priority: z.enum(["low", "medium", "high"]).optional().default("medium").describe("Idea priority: low, medium, or high"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();
    const fragments: KitResultFragment[] = [];

    // Ensure topic exists in the taxonomy
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
          contentCount: 0,
          lastUsedAt: now,
          createdAt: now,
        });
        fragments.push(kit.created(topicId, "topic", `Topic "${args.topic}" added.`));
      } else {
        await db
          .update(topics)
          .set({ lastUsedAt: now })
          .where(eq(topics.id, existing[0].id));
      }
    }

    const ideaId = `idea_${nanoid()}`;
    await db.insert(ideas).values({
      id: ideaId,
      title: args.title,
      description: args.description ?? null,
      topic: args.topic ?? null,
      targetChannel: args.target_channel ?? null,
      inspiration: args.inspiration ?? null,
      priority: args.priority,
      status: "captured",
      createdAt: now,
      updatedAt: now,
    });

    fragments.push(kit.created(ideaId, "idea", `Idea "${args.title}" captured.`));
    return kit.result(fragments);
  },
});
