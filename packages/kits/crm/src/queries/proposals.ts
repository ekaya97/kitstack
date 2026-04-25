import { eq, desc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { proposals, deals } from "../schema";

/**
 * Get all proposals with associated deal names.
 * Used by: proposal loader
 */
export async function getProposalsWithDeals(db: LibSQLDatabase) {
  return db
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
}
