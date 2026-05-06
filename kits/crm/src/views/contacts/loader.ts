import { defineLoader } from "@kitstackco/sdk";
import { isNull, desc, sql, eq } from "drizzle-orm";
import { contacts, companies, interactions } from "../../schema";

export const loader = defineLoader(async (db) => {
  const rows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      role: contacts.role,
      relationship: contacts.relationship,
      tags: contacts.tags,
      companyName: companies.name,
      lastInteraction: sql<string>`(
        SELECT MAX(${interactions.occurredAt})
        FROM ${interactions}
        WHERE ${interactions.contactId} = ${contacts.id}
      )`,
    })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(isNull(contacts.archivedAt))
    .orderBy(desc(contacts.createdAt))
    .limit(100);

  return rows;
});
