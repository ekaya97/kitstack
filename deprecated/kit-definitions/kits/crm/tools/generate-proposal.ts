import { nanoid } from "nanoid";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { deals, contacts, proposals } from "../schema";

export const generateProposal = defineTool({
  name: "generate_proposal",
  description: "Generate and store a proposal draft for a deal",
  args: z.object({
    dealId: z.string().describe("Deal ID"),
    content: z.string().describe("The proposal content (markdown)"),
  }),
  handler: async (db, args) => {
    const deal = await db.select().from(deals).where(eq(deals.id, args.dealId)).then((r: any[]) => r[0]);
    if (!deal) {
      return { content: [{ type: "text" as const, text: "Deal not found." }], isError: true };
    }

    // Get current version count
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

    return {
      content: [{ type: "text" as const, text: `Proposal v${version} saved for deal "${deal.name}" (status: draft).` }],
    };
  },
});
