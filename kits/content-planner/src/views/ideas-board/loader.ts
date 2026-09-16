import { defineLoader } from "@kitstackco/sdk";
import { isNull, desc } from "drizzle-orm";
import { ideas } from "../../schema";

export const loader = defineLoader(async (ctx) => {
  const rows = await ctx.db
    .select({
      id: ideas.id,
      title: ideas.title,
      description: ideas.description,
      topic: ideas.topic,
      targetChannel: ideas.targetChannel,
      priority: ideas.priority,
      status: ideas.status,
      createdAt: ideas.createdAt,
    })
    .from(ideas)
    .where(isNull(ideas.archivedAt))
    .orderBy(desc(ideas.createdAt))
    .limit(100);

  return rows;
});
