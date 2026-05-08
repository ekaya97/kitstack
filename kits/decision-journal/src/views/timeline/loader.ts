import { defineLoader } from "@kitstackco/sdk";
import { isNull, desc, eq } from "drizzle-orm";
import { decisions, outcomes } from "../../schema";

export const loader = defineLoader(async (db) => {
  const allDecisions = await db
    .select()
    .from(decisions)
    .where(isNull(decisions.archivedAt))
    .orderBy(desc(decisions.decidedAt))
    .limit(50);

  const allOutcomes = await db.select().from(outcomes);

  // Build outcome map: decisionId -> latest assessment
  const outcomeMap = new Map<string, string>();
  for (const o of allOutcomes) {
    outcomeMap.set(o.decisionId, o.assessment ?? "too_early");
  }

  return allDecisions.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    confidence: d.confidence,
    stakes: d.stakes,
    decidedAt: d.decidedAt,
    context: d.context,
    decision: d.decision,
    reasoning: d.reasoning,
    reversibility: d.reversibility,
    outcome: outcomeMap.get(d.id) ?? null,
  }));
});
