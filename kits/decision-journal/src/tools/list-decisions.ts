import { z } from "zod";
import { eq, like, isNull, desc, and, gte, lte, SQL } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { decisions, outcomes } from "../schema";

export const listDecisions = defineTool({
  name: "list_decisions",
  description: "List decisions with optional filters by category, confidence, urgency, or time period",
  args: z.object({
    category: z.enum(["business", "product", "hiring", "financial", "personal", "strategy"]).optional()
      .describe("Filter by category"),
    confidence: z.enum(["high", "medium", "low"]).optional()
      .describe("Filter by confidence level"),
    urgency: z.enum(["high", "medium", "low"]).optional()
      .describe("Filter by urgency level"),
    stakes: z.enum(["low", "medium", "high"]).optional()
      .describe("Filter by stakes level"),
    period: z.string().optional()
      .describe("Time period: this_month, last_month, this_quarter, this_year, or YYYY-MM-DD..YYYY-MM-DD range"),
    limit: z.number().optional().default(25).describe("Max results (default: 25)"),
  }),
  handler: async (db, args) => {
    const conditions: SQL[] = [isNull(decisions.archivedAt)];

    if (args.category) conditions.push(eq(decisions.category, args.category));
    if (args.confidence) conditions.push(eq(decisions.confidence, args.confidence));
    if (args.urgency) conditions.push(eq(decisions.urgency, args.urgency));
    if (args.stakes) conditions.push(eq(decisions.stakes, args.stakes));

    if (args.period) {
      const { from, to } = resolvePeriod(args.period);
      if (from) conditions.push(gte(decisions.decidedAt, from));
      if (to) conditions.push(lte(decisions.decidedAt, to));
    }

    const rows = await db
      .select()
      .from(decisions)
      .where(and(...conditions))
      .orderBy(desc(decisions.decidedAt))
      .limit(args.limit);

    if (rows.length === 0) return kit.text("No decisions found matching those filters.");

    // Fetch outcome assessments for these decisions
    const decisionIds = rows.map((r) => r.id);
    const allOutcomes = await db.select().from(outcomes);
    const outcomeMap = new Map<string, string>();
    for (const o of allOutcomes) {
      if (decisionIds.includes(o.decisionId)) {
        outcomeMap.set(o.decisionId, o.assessment ?? "—");
      }
    }

    let table = `${rows.length} decision(s):\n\n| Date | Title | Category | Confidence | Outcome |\n|------|-------|----------|------------|--------|\n`;
    for (const d of rows) {
      const outcome = outcomeMap.get(d.id) ?? "pending";
      table += `| ${d.decidedAt.slice(0, 10)} | ${d.title} | ${d.category || "—"} | ${d.confidence || "—"} | ${outcome} |\n`;
    }
    return kit.text(table);
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
    case "last_month": {
      const lm = month === 0 ? 11 : month - 1;
      const ly = month === 0 ? year - 1 : year;
      return { from: `${ly}-${String(lm + 1).padStart(2, "0")}-01`, to: `${year}-${String(month + 1).padStart(2, "0")}-01` };
    }
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
