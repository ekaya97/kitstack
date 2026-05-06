import { z } from "zod";
import { eq, like, isNull } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { deals } from "../schema";

export const updateDeal = defineTool({
  name: "update_deal",
  description: "Move a deal through stages or update details",
  args: z.object({
    deal: z.string().describe("Deal ID (deal_xxx) or title for fuzzy match"),
    stage: z.string().optional().describe("New stage: lead, contacted, proposal, negotiation, won, lost"),
    value: z.number().optional().describe("New value in cents"),
    probability: z.number().optional().describe("Win probability 0-100"),
    expected_close: z.string().optional().describe("Expected close date (ISO)"),
    lost_reason: z.string().optional().describe("Reason for losing the deal"),
    notes: z.string().optional().describe("Updated notes"),
  }),
  handler: async (db, args) => {
    // Resolve deal
    let dealId: string;
    if (args.deal.startsWith("deal_")) {
      dealId = args.deal;
    } else {
      const matches = await db
        .select({ id: deals.id, title: deals.title })
        .from(deals)
        .where(like(deals.title, `%${args.deal}%`))
        .limit(5);

      if (matches.length === 0) return kit.error(`No deal found matching "${args.deal}".`);
      if (matches.length > 1) {
        const list = matches.map((d) => `• ${d.title} (${d.id})`).join("\n");
        return kit.text(`Multiple deals match. Please specify:\n${list}`);
      }
      dealId = matches[0].id;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.stage !== undefined) updates.stage = args.stage;
    if (args.value !== undefined) updates.valueCents = args.value;
    if (args.probability !== undefined) updates.probability = args.probability;
    if (args.expected_close !== undefined) updates.expectedClose = args.expected_close;
    if (args.lost_reason !== undefined) updates.lostReason = args.lost_reason;
    if (args.notes !== undefined) updates.notes = args.notes;

    await db.update(deals).set(updates).where(eq(deals.id, dealId));

    const changes = Object.keys(updates).filter((k) => k !== "updatedAt").join(", ");
    return kit.result(kit.updated(dealId, "deal", `Deal updated: ${changes}.`));
  },
});
