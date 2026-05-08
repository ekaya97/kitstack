import { z } from "zod";
import { isNull, eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { decisions, outcomes } from "../schema";

export const calibration = defineTool({
  name: "calibration",
  description: "How well does stated confidence predict outcomes? Shows hit rates per confidence level and flags overconfidence",
  args: z.object({
    period: z.string().optional()
      .describe("Time period: this_month, this_quarter, this_year, or YYYY-MM-DD..YYYY-MM-DD"),
  }),
  handler: async (db, args) => {
    const allDecisions = await db.select().from(decisions).where(isNull(decisions.archivedAt));
    const allOutcomes = await db.select().from(outcomes);

    // Filter by period
    let filtered = allDecisions;
    if (args.period?.includes("..")) {
      const [from, to] = args.period.split("..");
      if (from) filtered = filtered.filter((d) => d.decidedAt >= from);
      if (to) filtered = filtered.filter((d) => d.decidedAt <= to);
    }

    // Build outcome map (latest outcome per decision)
    const outcomeMap = new Map<string, (typeof allOutcomes)[0]>();
    for (const o of allOutcomes) {
      const existing = outcomeMap.get(o.decisionId);
      if (!existing || o.createdAt > existing.createdAt) {
        outcomeMap.set(o.decisionId, o);
      }
    }

    // Only analyze decisions that have both confidence and a non-pending outcome
    const calibrationData = filtered
      .filter((d) => d.confidence && outcomeMap.has(d.id))
      .map((d) => ({
        confidence: d.confidence!,
        assessment: outcomeMap.get(d.id)!.assessment,
        title: d.title,
      }))
      .filter((d) => d.assessment && d.assessment !== "too_early");

    if (calibrationData.length < 3) {
      return kit.text(
        `Need at least 3 decisions with both confidence levels and outcome assessments for calibration analysis. Currently have ${calibrationData.length}. Keep logging decisions and reviewing outcomes!`
      );
    }

    const sections: string[] = [];
    sections.push(`## Confidence Calibration\n*${calibrationData.length} decisions with outcomes analyzed*`);

    // Build matrix
    const matrix: Record<string, { good: number; mixed: number; bad: number }> = {
      high: { good: 0, mixed: 0, bad: 0 },
      medium: { good: 0, mixed: 0, bad: 0 },
      low: { good: 0, mixed: 0, bad: 0 },
    };

    for (const d of calibrationData) {
      const row = matrix[d.confidence];
      if (row && d.assessment && d.assessment in row) {
        row[d.assessment as "good" | "mixed" | "bad"]++;
      }
    }

    let table = "\n| Confidence | Good | Mixed | Bad | Hit Rate |\n|-----------|------|-------|-----|----------|\n";
    for (const level of ["high", "medium", "low"]) {
      const row = matrix[level];
      const total = row.good + row.mixed + row.bad;
      if (total === 0) continue;
      const hitRate = Math.round((row.good / total) * 100);
      table += `| ${level} | ${row.good} | ${row.mixed} | ${row.bad} | ${hitRate}% |\n`;
    }
    sections.push(table);

    // Calibration insight
    const high = matrix.high;
    const low = matrix.low;
    const highTotal = high.good + high.mixed + high.bad;
    const lowTotal = low.good + low.mixed + low.bad;

    if (highTotal >= 2 && lowTotal >= 2) {
      const highHitRate = high.good / highTotal;
      const lowHitRate = low.good / lowTotal;

      if (highHitRate < 0.5) {
        sections.push("\n**Insight:** Your high-confidence decisions have a below-average success rate. You may be overconfident — consider slowing down when you feel certain.");
      } else if (lowHitRate > 0.6) {
        sections.push("\n**Insight:** Your low-confidence decisions actually turn out well more often than expected. You may be underconfident in certain areas — trust your judgment more.");
      } else if (highHitRate > 0.7) {
        sections.push("\n**Insight:** Your confidence is well-calibrated — high-confidence decisions consistently lead to good outcomes. Keep trusting your assessment.");
      }
    }

    // Flag worst misses: high confidence + bad outcome
    const misses = calibrationData.filter((d) => d.confidence === "high" && d.assessment === "bad");
    if (misses.length > 0) {
      sections.push("\n### High-Confidence Misses");
      for (const m of misses) {
        sections.push(`- ${m.title}`);
      }
      sections.push("\nThese are worth revisiting — what made you feel confident, and what did you miss?");
    }

    return kit.text(sections.join("\n"));
  },
});
