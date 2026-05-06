import { z } from "zod";
import { eq, isNull, sql } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { deals } from "../schema";

export const pipeline = defineTool({
  name: "pipeline",
  description: "Show deal pipeline summary with stage counts and values",
  args: z.object({}),
  handler: async (db) => {
    const stages = ["lead", "contacted", "proposal", "negotiation", "won", "lost"];

    const rows = await db
      .select({
        stage: deals.stage,
        count: sql<number>`count(*)`,
        totalCents: sql<number>`coalesce(sum(${deals.valueCents}), 0)`,
      })
      .from(deals)
      .where(isNull(deals.archivedAt))
      .groupBy(deals.stage);

    const stageMap = new Map(rows.map((r) => [r.stage, r]));

    let table = "### Deal Pipeline\n\n| Stage | Deals | Total Value |\n|-------|-------|-------------|\n";
    let totalDeals = 0;
    let totalValue = 0;

    for (const stage of stages) {
      const data = stageMap.get(stage);
      const count = data?.count ?? 0;
      const value = data?.totalCents ?? 0;
      totalDeals += count;
      totalValue += value;
      table += `| ${stage} | ${count} | EUR ${(value / 100).toFixed(2)} |\n`;
    }

    table += `| **Total** | **${totalDeals}** | **EUR ${(totalValue / 100).toFixed(2)}** |\n`;

    return kit.text(table);
  },
});
