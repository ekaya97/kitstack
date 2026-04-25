import { z } from "zod";
import { desc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { deals, activities } from "../schema";

const STAGES = ["prospect", "proposal", "negotiation", "won", "lost"] as const;

const pipelineDashboardArgs = z.object({});

async function loadPipelineSummary(db: LibSQLDatabase, args: z.infer<typeof pipelineDashboardArgs>, ctx: KitContext) {
  const allDeals = await db.select().from(deals);
  const recentActivities = await db
    .select()
    .from(activities)
    .orderBy(desc(activities.createdAt))
    .limit(8);

  const stages = STAGES.map((stage) => {
    const stageDeals = allDeals.filter((d) => d.stage === stage);
    return {
      stage,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0),
    };
  });

  const total = stages.reduce((s, st) => s + st.value, 0);
  const open = stages
    .filter((s) => s.stage !== "won" && s.stage !== "lost")
    .reduce((s, st) => s + st.value, 0);
  const won = stages.find((s) => s.stage === "won")?.value ?? 0;

  return { stages, total, open, won, recentActivities };
}

export const pipelineDashboard = defineTool({
  name: "pipeline_dashboard",
  description: "View pipeline overview — deals grouped by stage with totals",
  args: pipelineDashboardArgs,
  load: loadPipelineSummary,

  handler: async (db, args, ctx) => {
    const summary = await loadPipelineSummary(db, args, ctx);
    if (summary.stages.every((s) => s.count === 0)) {
      return kit.text("Pipeline is empty. Add some deals to get started.");
    }

    let text = "# Pipeline Dashboard\n\n";
    text += "| Stage | Deals | Value |\n|-------|-------|-------|\n";
    for (const s of summary.stages) {
      text += `| ${s.stage} | ${s.count} | €${s.value.toLocaleString()} |\n`;
    }
    text += `\n**Total pipeline value:** €${summary.total.toLocaleString()}\n`;
    text += `**Open pipeline:** €${summary.open.toLocaleString()}\n`;
    text += `**Won:** €${summary.won.toLocaleString()}\n`;

    return kit.text(text);
  },
});
