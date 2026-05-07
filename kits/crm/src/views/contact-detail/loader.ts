import { defineLoader } from "@kitstackco/sdk";
import { eq, desc, isNull } from "drizzle-orm";
import { contacts, companies, deals, interactions } from "../../schema";

export const loader = defineLoader(async (db) => {
  // Load the most recently contacted person as default
  const recentInteraction = await db
    .select({ contactId: interactions.contactId })
    .from(interactions)
    .orderBy(desc(interactions.createdAt))
    .limit(1);

  const contactId = recentInteraction[0]?.contactId;
  if (!contactId) return null;

  const [contact] = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
      role: contacts.role,
      relationship: contacts.relationship,
      source: contacts.source,
      notes: contacts.notes,
      companyName: companies.name,
    })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) return null;

  const contactDeals = await db
    .select()
    .from(deals)
    .where(eq(deals.contactId, contactId));

  const contactInteractions = await db
    .select()
    .from(interactions)
    .where(eq(interactions.contactId, contactId))
    .orderBy(desc(interactions.createdAt))
    .limit(15);

  return { contact, deals: contactDeals, activities: contactInteractions };
});
