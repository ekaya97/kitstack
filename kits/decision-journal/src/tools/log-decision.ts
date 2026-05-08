import { z } from "zod";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { decisions } from "../schema";

export const logDecision = defineTool({
  name: "log_decision",
  description: "Record a decision with full context, reasoning, and confidence level. Use when the user has reached a conclusion on something meaningful.",
  args: z.object({
    title: z.string().describe("Short decision summary (e.g., 'Chose React over Vue for the dashboard')"),
    context: z.string().describe("What situation prompted this decision"),
    options_considered: z.string().optional().describe("What alternatives were on the table"),
    decision: z.string().describe("What was decided"),
    reasoning: z.string().describe("Why this option was chosen over alternatives"),
    confidence: z.enum(["high", "medium", "low"]).optional().describe("How confident the user is in this choice"),
    urgency: z.enum(["high", "medium", "low"]).optional().describe("Was this a time-pressured decision?"),
    category: z.enum(["business", "product", "hiring", "financial", "personal", "strategy"]).optional()
      .describe("Decision category"),
    reversibility: z.enum(["easily_reversible", "hard_to_reverse", "irreversible"]).optional()
      .describe("How reversible is this decision?"),
    stakes: z.enum(["low", "medium", "high"]).optional().describe("What's at stake"),
    tags: z.string().optional().describe("Comma-separated tags for grouping"),
    decided_at: z.string().optional().describe("When the decision was made (ISO date). Defaults to today."),
    review_date: z.string().optional().describe("When to revisit this decision (ISO date)"),
  }),
  handler: async (db, args) => {
    const id = `dec_${nanoid()}`;
    const now = new Date().toISOString();
    const decidedAt = args.decided_at ?? now.slice(0, 10);

    // Default review date based on reversibility
    let reviewDate = args.review_date ?? null;
    if (!reviewDate && args.reversibility) {
      const days = args.reversibility === "irreversible" ? 90
        : args.reversibility === "hard_to_reverse" ? 90
        : 30;
      const d = new Date(decidedAt);
      d.setDate(d.getDate() + days);
      reviewDate = d.toISOString().slice(0, 10);
    }

    await db.insert(decisions).values({
      id,
      title: args.title,
      context: args.context,
      optionsConsidered: args.options_considered ?? null,
      decision: args.decision,
      reasoning: args.reasoning,
      confidence: args.confidence ?? null,
      urgency: args.urgency ?? null,
      category: args.category ?? null,
      reversibility: args.reversibility ?? null,
      stakes: args.stakes ?? null,
      tags: args.tags ?? null,
      decidedAt,
      reviewDate,
      createdAt: now,
      updatedAt: now,
    });

    const msg = `Decision "${args.title}" logged.${reviewDate ? ` Review scheduled for ${reviewDate}.` : ""}`;
    return kit.result(kit.created(id, "decision", msg));
  },
});
