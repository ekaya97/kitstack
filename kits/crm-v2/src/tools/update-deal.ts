import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { deals } from "../schema";

export const updateDeal = defineTool({
  name: "update_deal",
  description: "Move a deal through stages or update details",
  args: z.object({
    dealId: z.string().describe("Deal ID"),
    stage: z.enum(["lead", "contacted", "proposal", "negotiation", "won", "lost"]).optional().describe("New pipeline stage"),
    valueCents: z.number().optional().describe("Updated deal value in cents"),
    probability: z.number().optional().describe("Win probability 0-100"),
    expectedClose: z.string().optional().describe("Expected close date"),
    lostReason: z.string().optional().describe("Reason for losing the deal"),
    notes: z.string().optional().describe("Updated notes"),
  }),
  handler: async (db, args) => {
    const existing = await db.select().from(deals).where(eq(deals.id, args.dealId)).then(r => r[0]);
    if (!existing) {
      return kit.text(`Deal with ID "${args.dealId}" not found.`);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.stage !== undefined) updates.stage = args.stage;
    if (args.valueCents !== undefined) updates.valueCents = args.valueCents;
    if (args.probability !== undefined) updates.probability = args.probability;
    if (args.expectedClose !== undefined) updates.expectedClose = args.expectedClose;
    if (args.lostReason !== undefined) updates.lostReason = args.lostReason;
    if (args.notes !== undefined) updates.notes = args.notes;

    if (Object.keys(updates).length <= 1) {
      return kit.text("No changes specified.");
    }

    await db.update(deals).set(updates).where(eq(deals.id, args.dealId));
    const changes = Object.entries(updates)
      .filter(([k]) => k !== "updatedAt")
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    return kit.result(
      kit.updated(args.dealId, "deal", `Deal "${existing.title}" updated — ${changes}.`)
    );
  },
});
