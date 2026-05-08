import { z } from "zod";
import { isNull, isNotNull, lte, asc } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { decisions } from "../schema";

export const reviewDue = defineTool({
  name: "review_due",
  description: "Show decisions that are due for review — either overdue or coming up in the next 7 days",
  args: z.object({
    days_ahead: z.number().optional().default(7).describe("How many days ahead to look (default 7)"),
  }),
  handler: async (db, args) => {
    const today = new Date().toISOString().slice(0, 10);
    const ahead = new Date(Date.now() + args.days_ahead * 86400000).toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(decisions)
      .where(isNotNull(decisions.reviewDate))
      .orderBy(asc(decisions.reviewDate))
      .limit(50);

    const active = rows.filter((r) => !r.archivedAt);
    const overdue = active.filter((r) => r.reviewDate! < today);
    const upcoming = active.filter((r) => r.reviewDate! >= today && r.reviewDate! <= ahead);

    if (overdue.length === 0 && upcoming.length === 0) {
      return kit.text("No decisions due for review. You're all caught up!");
    }

    const sections: string[] = [];

    if (overdue.length > 0) {
      let table = `### Overdue (${overdue.length})\n\n| Review Date | Title | Category | Confidence |\n|-------------|-------|----------|------------|\n`;
      for (const d of overdue) {
        table += `| ${d.reviewDate} | ${d.title} | ${d.category || "—"} | ${d.confidence || "—"} |\n`;
      }
      sections.push(table);
    }

    if (upcoming.length > 0) {
      let table = `### Upcoming (${upcoming.length})\n\n| Review Date | Title | Category | Confidence |\n|-------------|-------|----------|------------|\n`;
      for (const d of upcoming) {
        table += `| ${d.reviewDate} | ${d.title} | ${d.category || "—"} | ${d.confidence || "—"} |\n`;
      }
      sections.push(table);
    }

    return kit.text(sections.join("\n"));
  },
});
