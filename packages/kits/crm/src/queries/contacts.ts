import { eq, desc, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { contacts, deals, activities } from "../schema";

/**
 * Get all contacts with deal count and last activity date.
 * Used by: contacts loader, list_contacts tool
 */
export async function getContactsWithStats(db: LibSQLDatabase) {
  const allContacts = await db.select().from(contacts).orderBy(desc(contacts.createdAt));

  // Get deal counts per contact
  const dealCounts = await db
    .select({
      contactId: deals.contactId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(deals)
    .groupBy(deals.contactId);

  // Get last activity date per contact
  const lastActivities = await db
    .select({
      contactId: activities.contactId,
      lastDate: sql<number>`max(created_at)`.as("last_date"),
    })
    .from(activities)
    .groupBy(activities.contactId);

  const dealCountMap = new Map(dealCounts.map((d) => [d.contactId, d.count]));
  const lastActivityMap = new Map(lastActivities.map((a) => [a.contactId, a.lastDate]));

  return allContacts.map((c) => ({
    ...c,
    dealCount: dealCountMap.get(c.id) ?? 0,
    lastActivityAt: lastActivityMap.get(c.id) ?? null,
  }));
}

/**
 * Get full contact detail with related deals and recent activities.
 * Used by: contact-detail loader, get_contact_detail tool
 */
export async function getContactDetail(db: LibSQLDatabase, contactId: string) {
  const contact = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .then((r) => r[0]);

  if (!contact) return null;

  const contactDeals = await db
    .select()
    .from(deals)
    .where(eq(deals.contactId, contactId))
    .orderBy(desc(deals.createdAt));

  const recentActivities = await db
    .select()
    .from(activities)
    .where(eq(activities.contactId, contactId))
    .orderBy(desc(activities.createdAt))
    .limit(15);

  return {
    contact,
    deals: contactDeals,
    recentActivities,
  };
}
