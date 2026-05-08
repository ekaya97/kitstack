import { z } from "zod";
import { desc, sql, asc } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { topics } from "../schema";

export const topicAnalysis = defineTool({
  name: "topic_analysis",
  description:
    "Show topic coverage analysis — which topics are overdue, which are fresh, and how often each has been used.",
  args: z.object({}),
  handler: async (db) => {
    const rows = await db
      .select()
      .from(topics)
      .orderBy(asc(topics.lastUsedAt));

    if (rows.length === 0) return kit.text("No topics tracked yet. Topics are created when you capture ideas or create content.");

    const now = new Date();
    let table = `${rows.length} topic(s):\n\n| Topic | Content Count | Last Used | Days Since |\n|-------|--------------|-----------|------------|\n`;

    for (const t of rows) {
      const daysSince = t.lastUsedAt
        ? Math.floor((now.getTime() - new Date(t.lastUsedAt).getTime()) / (1000 * 60 * 60 * 24))
        : "never";
      table += `| ${t.name} | ${t.contentCount ?? 0} | ${t.lastUsedAt?.split("T")[0] || "—"} | ${daysSince} |\n`;
    }

    // Highlight overdue topics (>30 days)
    const overdue = rows.filter((t) => {
      if (!t.lastUsedAt) return true;
      const days = (now.getTime() - new Date(t.lastUsedAt).getTime()) / (1000 * 60 * 60 * 24);
      return days > 30;
    });

    if (overdue.length > 0) {
      table += `\n**Overdue (30+ days):** ${overdue.map((t) => t.name).join(", ")}`;
    }

    return kit.text(table);
  },
});
