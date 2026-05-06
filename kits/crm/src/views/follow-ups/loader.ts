import { defineLoader } from "@kitstackco/sdk";
import { isNotNull, asc, eq } from "drizzle-orm";
import { interactions, contacts } from "../../schema";

export const loader = defineLoader(async (db) => {
  const rows = await db
    .select({
      id: interactions.id,
      contactId: interactions.contactId,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      followUp: interactions.followUp,
      followUpBy: interactions.followUpBy,
      summary: interactions.summary,
      type: interactions.type,
      occurredAt: interactions.occurredAt,
    })
    .from(interactions)
    .innerJoin(contacts, eq(interactions.contactId, contacts.id))
    .where(isNotNull(interactions.followUpBy))
    .orderBy(asc(interactions.followUpBy))
    .limit(50);

  return rows;
});
