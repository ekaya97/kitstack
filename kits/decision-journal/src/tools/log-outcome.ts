import { z } from "zod";
import { like, eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { decisions, outcomes } from "../schema";

export const logOutcome = defineTool({
  name: "log_outcome",
  description: "Record the outcome of a past decision — what actually happened, assessment, and lessons learned",
  args: z.object({
    decision: z.string().describe("Decision title or ID (dec_xxx) to record an outcome for"),
    outcome: z.string().describe("What actually happened as a result of this decision"),
    assessment: z.enum(["good", "mixed", "bad", "too_early"]).optional()
      .describe("How did the decision turn out?"),
    what_i_learned: z.string().optional().describe("Retrospective insight — what would you tell your past self?"),
    would_decide_differently: z.boolean().optional().describe("Knowing what you know now, would you choose differently?"),
  }),
  handler: async (db, args) => {
    // Resolve decision by ID or title
    let decisionId: string;
    let decisionTitle: string;

    if (args.decision.startsWith("dec_")) {
      const row = await db.select({ id: decisions.id, title: decisions.title })
        .from(decisions).where(eq(decisions.id, args.decision)).limit(1);
      if (row.length === 0) return kit.error(`Decision ${args.decision} not found.`);
      decisionId = row[0].id;
      decisionTitle = row[0].title;
    } else {
      const matches = await db.select({ id: decisions.id, title: decisions.title })
        .from(decisions).where(like(decisions.title, `%${args.decision}%`)).limit(5);
      if (matches.length === 0) return kit.error(`No decision matching "${args.decision}" found.`);
      if (matches.length > 1) {
        const list = matches.map((m) => `- ${m.title}`).join("\n");
        return kit.error(`Multiple decisions match "${args.decision}":\n${list}\nPlease be more specific.`);
      }
      decisionId = matches[0].id;
      decisionTitle = matches[0].title;
    }

    const id = `out_${nanoid()}`;
    const now = new Date().toISOString();

    await db.insert(outcomes).values({
      id,
      decisionId,
      outcome: args.outcome,
      assessment: args.assessment ?? null,
      whatILearned: args.what_i_learned ?? null,
      wouldDecideDifferently: args.would_decide_differently ? 1 : 0,
      recordedAt: now.slice(0, 10),
      createdAt: now,
    });

    const msg = `Outcome recorded for "${decisionTitle}".${args.assessment ? ` Assessment: ${args.assessment}.` : ""}`;
    return kit.result(kit.created(id, "outcome", msg));
  },
});
