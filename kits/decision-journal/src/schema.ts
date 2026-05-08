import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  context: text("context").notNull(),
  optionsConsidered: text("options_considered"),
  decision: text("decision").notNull(),
  reasoning: text("reasoning").notNull(),
  confidence: text("confidence"),
  urgency: text("urgency"),
  category: text("category"),
  reversibility: text("reversibility"),
  stakes: text("stakes"),
  tags: text("tags"),
  decidedAt: text("decided_at").notNull(),
  reviewDate: text("review_date"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_decisions_category").on(table.category),
  index("idx_decisions_decided_at").on(table.decidedAt),
  index("idx_decisions_review_date").on(table.reviewDate),
]);

export const outcomes = sqliteTable("outcomes", {
  id: text("id").primaryKey(),
  decisionId: text("decision_id").notNull().references(() => decisions.id),
  outcome: text("outcome").notNull(),
  assessment: text("assessment"),
  whatILearned: text("what_i_learned"),
  wouldDecideDifferently: integer("would_decide_differently"),
  recordedAt: text("recorded_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_outcomes_decision").on(table.decisionId),
  index("idx_outcomes_assessment").on(table.assessment),
]);

export const principles = sqliteTable("principles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  derivedFrom: text("derived_from"),
  timesReferenced: integer("times_referenced").default(0),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
