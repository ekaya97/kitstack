import { z } from "zod";
import { like, or, isNull } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { decisions, outcomes, principles } from "../schema";

export const search = defineTool({
  name: "search",
  description: "Full-text search across decisions, outcomes, and principles",
  args: z.object({
    query: z.string().describe("Search term"),
  }),
  handler: async (db, args) => {
    const q = `%${args.query}%`;
    const sections: string[] = [];

    // Search decisions
    const matchedDecisions = await db
      .select()
      .from(decisions)
      .where(
        or(
          like(decisions.title, q),
          like(decisions.context, q),
          like(decisions.decision, q),
          like(decisions.reasoning, q),
          like(decisions.optionsConsidered, q),
          like(decisions.tags, q)
        )
      )
      .limit(10);

    if (matchedDecisions.length > 0) {
      let table = "### Decisions\n\n| Date | Title | Category | Confidence |\n|------|-------|----------|------------|\n";
      for (const d of matchedDecisions) {
        table += `| ${d.decidedAt.slice(0, 10)} | ${d.title} | ${d.category || "—"} | ${d.confidence || "—"} |\n`;
      }
      sections.push(table);
    }

    // Search outcomes
    const matchedOutcomes = await db
      .select()
      .from(outcomes)
      .where(
        or(
          like(outcomes.outcome, q),
          like(outcomes.whatILearned, q)
        )
      )
      .limit(10);

    if (matchedOutcomes.length > 0) {
      let table = "### Outcomes\n\n| Date | Assessment | Outcome |\n|------|-----------|--------|\n";
      for (const o of matchedOutcomes) {
        table += `| ${o.recordedAt} | ${o.assessment || "—"} | ${o.outcome.slice(0, 80)} |\n`;
      }
      sections.push(table);
    }

    // Search principles
    const matchedPrinciples = await db
      .select()
      .from(principles)
      .where(
        or(
          like(principles.title, q),
          like(principles.description, q)
        )
      )
      .limit(10);

    if (matchedPrinciples.length > 0) {
      let table = "### Principles\n\n| Principle | Referenced |\n|-----------|----------|\n";
      for (const p of matchedPrinciples) {
        table += `| ${p.title} | ${p.timesReferenced ?? 0}× |\n`;
      }
      sections.push(table);
    }

    if (sections.length === 0) {
      return kit.text(`No results for "${args.query}".`);
    }

    return kit.text(`Search results for "${args.query}":\n\n${sections.join("\n")}`);
  },
});
