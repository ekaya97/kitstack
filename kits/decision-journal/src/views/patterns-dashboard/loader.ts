import { defineLoader } from "@kitstackco/sdk";
import { isNull, desc } from "drizzle-orm";
import { decisions, outcomes, principles } from "../../schema";

export const loader = defineLoader(async (db) => {
  const allDecisions = await db
    .select({
      id: decisions.id,
      title: decisions.title,
      category: decisions.category,
      confidence: decisions.confidence,
      urgency: decisions.urgency,
      stakes: decisions.stakes,
      decidedAt: decisions.decidedAt,
    })
    .from(decisions)
    .where(isNull(decisions.archivedAt));

  const allOutcomes = await db
    .select({
      id: outcomes.id,
      decisionId: outcomes.decisionId,
      assessment: outcomes.assessment,
      wouldDecideDifferently: outcomes.wouldDecideDifferently,
    })
    .from(outcomes);

  const allPrinciples = await db
    .select({
      id: principles.id,
      title: principles.title,
      description: principles.description,
      timesReferenced: principles.timesReferenced,
    })
    .from(principles)
    .where(isNull(principles.archivedAt))
    .orderBy(desc(principles.timesReferenced));

  return { decisions: allDecisions, outcomes: allOutcomes, principles: allPrinciples };
});
