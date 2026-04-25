import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { deals } from "../schema";

export const updateDeal = defineTool({
  name: "update_deal",
  description: "Update a deal's stage, value, or other details",
  args: z.object({
    dealId: z.string().describe("Deal ID"),
    stage: z.enum(["prospect", "proposal", "negotiation", "won", "lost"]).optional(),
    value: z.number().optional(),
    notes: z.string().optional(),
    expectedCloseDate: z.string().optional(),
  }),
  handler: async (db, args, ctx) => {
    const existing = await db
      .select()
      .from(deals)
      .where(eq(deals.id, args.dealId))
      .then((r) => r[0]);

    if (!existing) {
      return kit.notFound("Deal", args.dealId);
    }

    const updates: Record<string, unknown> = {};
    if (args.stage !== undefined) updates.stage = args.stage;
    if (args.value !== undefined) updates.value = args.value;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.expectedCloseDate !== undefined) updates.expectedCloseDate = args.expectedCloseDate;

    if (Object.keys(updates).length === 0) {
      return kit.text("No changes specified.");
    }

    await db.update(deals).set(updates).where(eq(deals.id, args.dealId));
    const changes = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(", ");
    return kit.text(`Deal "${existing.name}" updated — ${changes}.`);
  },
});
