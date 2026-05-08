import { z } from "zod";
import { like } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { topics } from "../schema";

export const addTopic = defineTool({
  name: "add_topic",
  description: "Add a new topic to the taxonomy for tracking content coverage.",
  args: z.object({
    name: z.string().describe("Topic name"),
    description: z.string().optional().describe("Brief description of this topic area"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();

    // Check for existing
    const existing = await db
      .select()
      .from(topics)
      .where(like(topics.name, args.name))
      .limit(1);

    if (existing.length > 0) {
      return kit.text(`Topic "${existing[0].name}" already exists.`);
    }

    const id = `top_${nanoid()}`;
    await db.insert(topics).values({
      id,
      name: args.name,
      description: args.description ?? null,
      contentCount: 0,
      createdAt: now,
    });

    return kit.result(kit.created(id, "topic", `Topic "${args.name}" added.`));
  },
});
