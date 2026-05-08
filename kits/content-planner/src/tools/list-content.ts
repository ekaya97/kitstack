import { z } from "zod";
import { eq, like, isNull, desc, and, gte, lte, SQL } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import type { KitContext } from "@kitstackco/sdk";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { content } from "../schema";

const listContentArgs = z.object({
  status: z
    .enum(["draft", "review", "scheduled", "published", "repurposed"])
    .optional()
    .describe("Filter by status"),
  channel: z
    .enum(["linkedin", "blog", "newsletter", "twitter", "instagram", "other"])
    .optional()
    .describe("Filter by channel"),
  format: z
    .enum(["post", "article", "carousel", "thread", "video_script", "newsletter"])
    .optional()
    .describe("Filter by format"),
  period: z
    .enum(["this_week", "this_month", "last_month", "this_year"])
    .optional()
    .describe("Filter by time period"),
  limit: z.number().optional().default(25).describe("Maximum number of content pieces to return"),
});

function periodRange(period: string): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDay();
  const today = now.toISOString().split("T")[0];

  switch (period) {
    case "this_week": {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: monday.toISOString().split("T")[0], end: sunday.toISOString().split("T")[0] };
    }
    case "this_month": {
      return { start: `${y}-${String(m + 1).padStart(2, "0")}-01`, end: today };
    }
    case "last_month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const lastDay = new Date(ly, lm + 1, 0).getDate();
      return {
        start: `${ly}-${String(lm + 1).padStart(2, "0")}-01`,
        end: `${ly}-${String(lm + 1).padStart(2, "0")}-${lastDay}`,
      };
    }
    case "this_year":
      return { start: `${y}-01-01`, end: today };
    default:
      return { start: "2000-01-01", end: today };
  }
}

async function loadContent(
  db: LibSQLDatabase,
  args: z.infer<typeof listContentArgs>,
  ctx: KitContext
) {
  const conditions: SQL[] = [isNull(content.archivedAt)];
  if (args.status) conditions.push(eq(content.status, args.status));
  if (args.channel) conditions.push(eq(content.channel, args.channel));
  if (args.format) conditions.push(eq(content.format, args.format));

  if (args.period) {
    const { start, end } = periodRange(args.period);
    conditions.push(gte(content.createdAt, start));
    conditions.push(lte(content.createdAt, end));
  }

  return db
    .select()
    .from(content)
    .where(and(...conditions))
    .orderBy(desc(content.createdAt))
    .limit(args.limit);
}

export const listContent = defineTool({
  name: "list_content",
  description: "List content pieces with optional filters for status, channel, format, and period.",
  args: listContentArgs,
  load: loadContent,
  handler: async (db, args, ctx) => {
    const rows = await loadContent(db, args, ctx);
    if (rows.length === 0) return kit.text("No content found.");

    let table = `${rows.length} piece(s):\n\n| Title | Channel | Format | Status | Scheduled | Published |\n|-------|---------|--------|--------|-----------|-----------|\n`;
    for (const r of rows) {
      table += `| ${r.title} | ${r.channel} | ${r.format || "—"} | ${r.status || "draft"} | ${r.scheduledDate || "—"} | ${r.publishedDate || "—"} |\n`;
    }
    return kit.text(table);
  },
});
