import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { deals } from "../schema";

export const pipelineDashboard = defineTool({
  name: "pipeline_dashboard",
  description: "View pipeline overview — deals grouped by stage with totals",
  args: z.object({}),
  handler: async (db) => {
    const allDeals = await db.select().from(deals);

    if (allDeals.length === 0) {
      return { content: [{ type: "text" as const, text: "Pipeline is empty. Add some deals to get started." }] };
    }

    const stages = ["prospect", "proposal", "negotiation", "won", "lost"] as const;
    const grouped = new Map<string, typeof allDeals>();
    for (const stage of stages) grouped.set(stage, []);
    for (const d of allDeals) grouped.get(d.stage)!.push(d);

    let totalValue = 0;
    let openValue = 0;

    let text = "# Pipeline Dashboard\n\n";
    text += "| Stage | Deals | Value |\n|-------|-------|-------|\n";

    for (const stage of stages) {
      const stageDeals = grouped.get(stage)!;
      const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      totalValue += stageValue;
      if (stage !== "won" && stage !== "lost") openValue += stageValue;
      text += `| ${stage} | ${stageDeals.length} | €${stageValue.toLocaleString()} |\n`;
    }

    text += `\n**Total pipeline value:** €${totalValue.toLocaleString()}\n`;
    text += `**Open pipeline:** €${openValue.toLocaleString()}\n`;
    text += `**Won:** €${(grouped.get("won")!.reduce((s, d) => s + (d.value || 0), 0)).toLocaleString()}\n`;

    return { content: [{ type: "text" as const, text }] };
  },
});
