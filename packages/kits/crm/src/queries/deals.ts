import { eq, desc, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { contacts, deals, activities } from "../schema";

const STAGES = ["prospect", "proposal", "negotiation", "won", "lost"] as const;

/**
 * Get all deals with contact names (left join).
 * Used by: pipeline loader, list_deals tool
 */
export async function getDealsWithContacts(db: LibSQLDatabase) {
  return db
    .select({
      id: deals.id,
      name: deals.name,
      contactId: deals.contactId,
      value: deals.value,
      currency: deals.currency,
      stage: deals.stage,
      notes: deals.notes,
      expectedCloseDate: deals.expectedCloseDate,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      contactName: contacts.name,
    })
    .from(deals)
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .orderBy(desc(deals.createdAt));
}

/**
 * Get pipeline summary: stage counts/values + recent activities.
 * Used by: dashboard loader, pipeline_dashboard tool
 */
export async function getPipelineSummary(db: LibSQLDatabase) {
  const allDeals = await db.select().from(deals);
  const recentActivities = await db
    .select()
    .from(activities)
    .orderBy(desc(activities.createdAt))
    .limit(8);

  const stages = STAGES.map((stage) => {
    const stageDeals = allDeals.filter((d) => d.stage === stage);
    return {
      stage,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0),
    };
  });

  const total = stages.reduce((s, st) => s + st.value, 0);
  const open = stages
    .filter((s) => s.stage !== "won" && s.stage !== "lost")
    .reduce((s, st) => s + st.value, 0);
  const won = stages.find((s) => s.stage === "won")?.value ?? 0;

  return { stages, total, open, won, recentActivities };
}
