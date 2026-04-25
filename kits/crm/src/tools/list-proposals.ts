import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool } from "../sdk";
import type { KitContext } from "../sdk";
import { proposals, deals } from "../schema";

const listProposalsArgs = z.object({
  dealId: z.string().optional().describe("Filter by deal ID"),
});

async function loadProposals(db: LibSQLDatabase, args: z.infer<typeof listProposalsArgs>, ctx: KitContext) {
  const query = db
    .select({
      id: proposals.id,
      dealId: proposals.dealId,
      content: proposals.content,
      version: proposals.version,
      status: proposals.status,
      createdAt: proposals.createdAt,
      dealName: deals.name,
    })
    .from(proposals)
    .leftJoin(deals, eq(proposals.dealId, deals.id))
    .orderBy(desc(proposals.createdAt));

  if (args.dealId) {
    return query.where(eq(proposals.dealId, args.dealId));
  }
  return query;
}

export const listProposals = defineTool({
  name: "list_proposals",
  description: "List proposals with optional deal filter",
  args: listProposalsArgs,
  load: loadProposals,
  // No handler — framework auto-wraps with kit.json()
});
