import { defineLoader } from "@kitstackco/sdk";
import { isNull, desc, eq } from "drizzle-orm";
import { deals, interactions, contacts } from "../../schema";

export const loader = defineLoader(async (db) => {
  const allDeals = await db
    .select()
    .from(deals)
    .where(isNull(deals.archivedAt));

  const recentInteractions = await db
    .select({
      id: interactions.id,
      type: interactions.type,
      summary: interactions.summary,
      contactId: interactions.contactId,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      createdAt: interactions.createdAt,
    })
    .from(interactions)
    .innerJoin(contacts, eq(interactions.contactId, contacts.id))
    .orderBy(desc(interactions.createdAt))
    .limit(8);

  return { deals: allDeals, activities: recentInteractions };
});
