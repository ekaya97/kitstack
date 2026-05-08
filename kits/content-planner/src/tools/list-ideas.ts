import { z } from "zod";
import { eq, like, isNull, desc, and, SQL } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import type { KitContext } from "@kitstackco/sdk";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { ideas } from "../schema";

const listIdeasArgs = z.object({
  status: z
    .enum(["captured", "developing", "ready", "rejected"])
    .optional()
    .describe("Filter by idea status"),
  topic: z.string().optional().describe("Filter by topic"),
  channel: z
    .enum(["linkedin", "blog", "newsletter", "twitter", "instagram", "other"])
    .optional()
    .describe("Filter by target channel"),
  priority: z.enum(["low", "medium", "high"]).optional().describe("Filter by priority"),
  limit: z.number().optional().default(25).describe("Maximum number of ideas to return"),
});

async function loadIdeas(db: LibSQLDatabase, args: z.infer<typeof listIdeasArgs>, ctx: KitContext) {
  const conditions: SQL[] = [isNull(ideas.archivedAt)];
  if (args.status) conditions.push(eq(ideas.status, args.status));
  if (args.topic) conditions.push(like(ideas.topic, `%${args.topic}%`));
  if (args.channel) conditions.push(eq(ideas.targetChannel, args.channel));
  if (args.priority) conditions.push(eq(ideas.priority, args.priority));

  return db
    .select()
    .from(ideas)
    .where(and(...conditions))
    .orderBy(desc(ideas.createdAt))
    .limit(args.limit);
}

export const listIdeas = defineTool({
  name: "list_ideas",
  description: "List content ideas with optional filters for status, topic, channel, or priority.",
  args: listIdeasArgs,
  load: loadIdeas,
  handler: async (db, args, ctx) => {
    const rows = await loadIdeas(db, args, ctx);
    if (rows.length === 0) return kit.text("No ideas found.");

    let table = `${rows.length} idea(s):\n\n| Title | Topic | Channel | Priority | Status |\n|-------|-------|---------|----------|--------|\n`;
    for (const r of rows) {
      table += `| ${r.title} | ${r.topic || "—"} | ${r.targetChannel || "—"} | ${r.priority || "medium"} | ${r.status || "captured"} |\n`;
    }
    return kit.text(table);
  },
});
