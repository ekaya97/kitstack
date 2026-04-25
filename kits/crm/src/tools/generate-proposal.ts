import { nanoid } from "nanoid";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { deals, proposals } from "../schema";

export const generateProposal = defineTool({
  name: "generate_proposal",
  description: "Generate and store a proposal draft for a deal",
  args: z.object({
    dealId: z.string().describe("Deal ID"),
    content: z.string().describe("The proposal content (markdown)"),
  }),
  handler: async (db, args, ctx) => {
    const deal = await db
      .select()
      .from(deals)
      .where(eq(deals.id, args.dealId))
      .then((r) => r[0]);

    if (!deal) {
      return kit.notFound("Deal", args.dealId);
    }

    const existing = await db.select().from(proposals).where(eq(proposals.dealId, args.dealId));
    const version = existing.length + 1;

    const id = nanoid();
    await db.insert(proposals).values({
      id,
      dealId: args.dealId,
      content: args.content,
      version,
      status: "draft",
    });

    return kit.text(`Proposal v${version} saved for deal "${deal.name}" (status: draft).`);
  },
});
