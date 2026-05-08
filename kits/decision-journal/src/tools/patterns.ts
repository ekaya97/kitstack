import { z } from "zod";
import { isNull, gte } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { decisions, outcomes } from "../schema";

export const patterns = defineTool({
  name: "patterns",
  description: "Analyze decision-making patterns: category distribution, confidence vs. outcomes, urgency correlation, and hindsight rate",
  args: z.object({
    period: z.string().optional()
      .describe("Time period to analyze: this_month, this_quarter, this_year, or YYYY-MM-DD..YYYY-MM-DD. Defaults to all time."),
  }),
  handler: async (db, args) => {
    // Load all decisions and outcomes
    const allDecisions = await db.select().from(decisions).where(isNull(decisions.archivedAt));
    const allOutcomes = await db.select().from(outcomes);

    // Filter by period if specified
    let filtered = allDecisions;
    if (args.period) {
      const { from, to } = resolvePeriod(args.period);
      if (from) filtered = filtered.filter((d) => d.decidedAt >= from);
      if (to) filtered = filtered.filter((d) => d.decidedAt <= to);
    }

    if (filtered.length === 0) {
      return kit.text("No decisions found for this period. Log some decisions first!");
    }

    // Build outcome lookup
    const outcomeMap = new Map<string, typeof allOutcomes>();
    for (const o of allOutcomes) {
      const existing = outcomeMap.get(o.decisionId) ?? [];
      existing.push(o);
      outcomeMap.set(o.decisionId, existing);
    }

    const sections: string[] = [];
    sections.push(`## Decision Patterns\n*${filtered.length} decisions analyzed*`);

    // Category breakdown
    const byCategory = new Map<string, number>();
    for (const d of filtered) {
      const cat = d.category || "uncategorized";
      byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
    }
    let catTable = "\n### By Category\n\n| Category | Count | % |\n|----------|-------|---|\n";
    for (const [cat, count] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
      catTable += `| ${cat} | ${count} | ${Math.round((count / filtered.length) * 100)}% |\n`;
    }
    sections.push(catTable);

    // Confidence distribution
    const byConfidence = new Map<string, number>();
    for (const d of filtered) {
      const conf = d.confidence || "unset";
      byConfidence.set(conf, (byConfidence.get(conf) || 0) + 1);
    }
    let confTable = "\n### Confidence Distribution\n\n| Confidence | Count | % |\n|-----------|-------|---|\n";
    for (const level of ["high", "medium", "low", "unset"]) {
      const count = byConfidence.get(level) || 0;
      if (count > 0) confTable += `| ${level} | ${count} | ${Math.round((count / filtered.length) * 100)}% |\n`;
    }
    sections.push(confTable);

    // Decisions with outcomes — confidence vs. outcome
    const withOutcomes = filtered.filter((d) => outcomeMap.has(d.id));
    if (withOutcomes.length >= 3) {
      const confOutcome = new Map<string, { good: number; mixed: number; bad: number; total: number }>();
      for (const d of withOutcomes) {
        const conf = d.confidence || "unset";
        if (!confOutcome.has(conf)) confOutcome.set(conf, { good: 0, mixed: 0, bad: 0, total: 0 });
        const bucket = confOutcome.get(conf)!;
        for (const o of outcomeMap.get(d.id) ?? []) {
          bucket.total++;
          if (o.assessment === "good") bucket.good++;
          else if (o.assessment === "mixed") bucket.mixed++;
          else if (o.assessment === "bad") bucket.bad++;
        }
      }
      let coTable = "\n### Confidence vs. Outcome\n\n| Confidence | Good | Mixed | Bad | Total |\n|-----------|------|-------|-----|-------|\n";
      for (const [conf, stats] of confOutcome) {
        coTable += `| ${conf} | ${stats.good} | ${stats.mixed} | ${stats.bad} | ${stats.total} |\n`;
      }
      sections.push(coTable);
    }

    // Urgency vs. outcome
    const highUrgency = withOutcomes.filter((d) => d.urgency === "high");
    const lowUrgency = withOutcomes.filter((d) => d.urgency === "low" || d.urgency === "medium");
    if (highUrgency.length > 0 && lowUrgency.length > 0) {
      const urgencyGood = (list: typeof withOutcomes) =>
        list.filter((d) => outcomeMap.get(d.id)?.some((o) => o.assessment === "good")).length;
      const urgencyBad = (list: typeof withOutcomes) =>
        list.filter((d) => outcomeMap.get(d.id)?.some((o) => o.assessment === "bad")).length;

      sections.push(`\n### Urgency Impact\n\n- High-urgency decisions: ${highUrgency.length} (${urgencyGood(highUrgency)} good, ${urgencyBad(highUrgency)} bad)`);
      sections.push(`- Low/medium-urgency decisions: ${lowUrgency.length} (${urgencyGood(lowUrgency)} good, ${urgencyBad(lowUrgency)} bad)`);
    }

    // Would-decide-differently rate
    const regrets = allOutcomes.filter((o) => o.wouldDecideDifferently === 1);
    if (regrets.length > 0) {
      sections.push(`\n### Hindsight\n\n${regrets.length} out of ${allOutcomes.length} outcomes (${Math.round((regrets.length / allOutcomes.length) * 100)}%) — would decide differently.`);
    }

    return kit.text(sections.join("\n"));
  },
});

function resolvePeriod(period: string): { from: string | null; to: string | null } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period.includes("..")) {
    const [from, to] = period.split("..");
    return { from, to };
  }

  switch (period) {
    case "this_month":
      return { from: `${year}-${String(month + 1).padStart(2, "0")}-01`, to: null };
    case "this_quarter": {
      const qStart = Math.floor(month / 3) * 3;
      return { from: `${year}-${String(qStart + 1).padStart(2, "0")}-01`, to: null };
    }
    case "this_year":
      return { from: `${year}-01-01`, to: null };
    default:
      return { from: null, to: null };
  }
}
