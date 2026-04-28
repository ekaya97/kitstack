import { z } from "zod";
import { eq, isNull, sql } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { deals } from "../schema";

const STAGES = ["lead", "contacted", "proposal", "negotiation", "won", "lost"] as const;

export async function loadPipeline(db: LibSQLDatabase, args: {}, ctx: KitContext) {
  return db
    .select({
      stage: deals.stage,
      count: sql<number>`count(*)`,
      totalCents: sql<number>`coalesce(sum(${deals.valueCents}), 0)`,
    })
    .from(deals)
    .where(isNull(deals.archivedAt))
    .groupBy(deals.stage);
}

export const pipeline = defineTool({
  name: "pipeline",
  description: "Show deal pipeline summary with stage counts and values",
  args: z.object({}),
  load: loadPipeline,
  handler: async (db, args, ctx) => {
    const result = await loadPipeline(db, args, ctx);

    const stageMap = new Map(result.map(r => [r.stage, r]));

    let text = "## Pipeline\n\n";
    text += "| Stage | Deals | Value |\n";
    text += "|-------|-------|-------|\n";

    let totalCents = 0;
    let openCents = 0;
    let wonCents = 0;

    for (const stage of STAGES) {
      const data = stageMap.get(stage);
      const count = data?.count ?? 0;
      const cents = data?.totalCents ?? 0;
      const value = `€${(cents / 100).toLocaleString()}`;
      text += `| ${stage} | ${count} | ${value} |\n`;

      totalCents += cents;
      if (stage === "won") wonCents = cents;
      if (stage !== "won" && stage !== "lost") openCents += cents;
    }

    text += `\n**Total pipeline value:** €${(totalCents / 100).toLocaleString()}\n`;
    text += `**Open pipeline:** €${(openCents / 100).toLocaleString()}\n`;
    text += `**Won:** €${(wonCents / 100).toLocaleString()}`;

    return kit.text(text);
  },
});
