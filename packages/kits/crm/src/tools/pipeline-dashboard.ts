import { z } from "zod";
import { defineTool, kit } from "../sdk";
import { getPipelineSummary } from "../queries/deals";

export const pipelineDashboard = defineTool({
  name: "pipeline_dashboard",
  description: "View pipeline overview — deals grouped by stage with totals",
  args: z.object({}),
  handler: async (db, args, ctx) => {
    const summary = await getPipelineSummary(db);

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
