import { defineLoader } from "@kitstackco/sdk";
import { isNull, sql } from "drizzle-orm";
import { deals, contacts, companies } from "../../schema";

export const loader = defineLoader(async (db) => {
  const rows = await db
    .select({
      id: deals.id,
      title: deals.title,
      stage: deals.stage,
      valueCents: deals.valueCents,
      currency: deals.currency,
      probability: deals.probability,
      expectedClose: deals.expectedClose,
      contactName: sql<string>`${contacts.firstName} || ' ' || coalesce(${contacts.lastName}, '')`,
      companyName: companies.name,
    })
    .from(deals)
    .leftJoin(contacts, sql`${deals.contactId} = ${contacts.id}`)
    .leftJoin(companies, sql`${deals.companyId} = ${companies.id}`)
    .where(isNull(deals.archivedAt));

  return rows;
});
