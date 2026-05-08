import { z } from "zod";
import { eq, like } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { decisions, outcomes, principles } from "../schema";

export const decisionDetail = defineTool({
  name: "decision_detail",
  description: "Show a single decision with its full context, outcomes, and linked principles",
  args: z.object({
    decision: z.string().describe("Decision title or ID (dec_xxx)"),
  }),
  handler: async (db, args) => {
    // Resolve decision
    let row;
    if (args.decision.startsWith("dec_")) {
      const rows = await db.select().from(decisions).where(eq(decisions.id, args.decision)).limit(1);
      row = rows[0];
    } else {
      const rows = await db.select().from(decisions)
        .where(like(decisions.title, `%${args.decision}%`)).limit(1);
      row = rows[0];
    }

    if (!row) return kit.error(`Decision "${args.decision}" not found.`);

    // Get outcomes
    const decOutcomes = await db.select().from(outcomes)
      .where(eq(outcomes.decisionId, row.id));

    // Get linked principles
    const linkedPrinciples = await db.select().from(principles)
      .where(like(principles.derivedFrom, `%${row.id}%`));

    const parts: string[] = [];
    parts.push(`## ${row.title}`);
    parts.push(`**Decided:** ${row.decidedAt.slice(0, 10)} · **Category:** ${row.category || "—"} · **Confidence:** ${row.confidence || "—"} · **Stakes:** ${row.stakes || "—"}`);
    parts.push("");
    parts.push(`### Context\n${row.context}`);
    if (row.optionsConsidered) parts.push(`\n### Options Considered\n${row.optionsConsidered}`);
    parts.push(`\n### Decision\n${row.decision}`);
    parts.push(`\n### Reasoning\n${row.reasoning}`);

    if (row.reversibility) parts.push(`\n**Reversibility:** ${row.reversibility.replace(/_/g, " ")}`);
    if (row.urgency) parts.push(`**Urgency:** ${row.urgency}`);
    if (row.reviewDate) parts.push(`**Review date:** ${row.reviewDate}`);
    if (row.tags) parts.push(`**Tags:** ${row.tags}`);

    if (decOutcomes.length > 0) {
      parts.push("\n### Outcomes");
      for (const o of decOutcomes) {
        parts.push(`\n**${o.recordedAt}** — Assessment: ${o.assessment || "pending"}`);
        parts.push(o.outcome);
        if (o.whatILearned) parts.push(`*Lesson:* ${o.whatILearned}`);
        if (o.wouldDecideDifferently) parts.push("*Would decide differently.*");
      }
    }

    if (linkedPrinciples.length > 0) {
      parts.push("\n### Principles Derived");
      for (const p of linkedPrinciples) {
        parts.push(`- **${p.title}**${p.description ? `: ${p.description}` : ""}`);
      }
    }

    return kit.text(parts.join("\n"));
  },
});
