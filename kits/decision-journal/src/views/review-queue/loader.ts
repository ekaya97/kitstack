import { defineLoader } from "@kitstackco/sdk";
import { isNull, isNotNull, asc } from "drizzle-orm";
import { decisions } from "../../schema";

export const loader = defineLoader(async (db) => {
  return await db
    .select({
      id: decisions.id,
      title: decisions.title,
      category: decisions.category,
      confidence: decisions.confidence,
      decidedAt: decisions.decidedAt,
      reviewDate: decisions.reviewDate,
      context: decisions.context,
      decision: decisions.decision,
    })
    .from(decisions)
    .where(isNotNull(decisions.reviewDate))
    .orderBy(asc(decisions.reviewDate))
    .limit(50);
});
