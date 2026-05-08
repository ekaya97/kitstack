import { z } from "zod";
import { isNull, desc } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { principles } from "../schema";

export const listPrinciples = defineTool({
  name: "principles",
  description: "List all personal decision-making principles",
  args: z.object({}),
  handler: async (db) => {
    const rows = await db
      .select()
      .from(principles)
      .where(isNull(principles.archivedAt))
      .orderBy(desc(principles.timesReferenced));

    if (rows.length === 0) {
      return kit.text("No principles saved yet. Principles are extracted from decision outcomes — keep logging decisions and reviewing them!");
    }

    let table = `${rows.length} principle(s):\n\n| Principle | Description | Referenced |\n|-----------|-------------|----------|\n`;
    for (const p of rows) {
      table += `| ${p.title} | ${p.description?.slice(0, 60) || "—"} | ${p.timesReferenced ?? 0}× |\n`;
    }
    return kit.text(table);
  },
});
