import { z } from "zod";
import { like, or, isNull } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { contacts, companies, interactions } from "../schema";

export const search = defineTool({
  name: "search",
  description: "Full-text search across contacts, companies, and interactions",
  args: z.object({
    query: z.string().describe("Search term"),
  }),
  handler: async (db, args) => {
    const q = `%${args.query}%`;
    const sections: string[] = [];

    // Search contacts
    const matchedContacts = await db
      .select()
      .from(contacts)
      .where(
        or(
          like(contacts.firstName, q),
          like(contacts.lastName, q),
          like(contacts.email, q),
          like(contacts.role, q),
          like(contacts.notes, q),
          like(contacts.tags, q)
        )
      )
      .limit(10);

    if (matchedContacts.length > 0) {
      let table = "### Contacts\n\n| Name | Role | Company | Relationship |\n|------|------|---------|-------------|\n";
      for (const c of matchedContacts) {
        table += `| ${c.firstName} ${c.lastName || ""} | ${c.role || "—"} | ${c.companyId || "—"} | ${c.relationship || "—"} |\n`;
      }
      sections.push(table);
    }

    // Search companies
    const matchedCompanies = await db
      .select()
      .from(companies)
      .where(
        or(
          like(companies.name, q),
          like(companies.domain, q),
          like(companies.industry, q),
          like(companies.notes, q)
        )
      )
      .limit(10);

    if (matchedCompanies.length > 0) {
      let table = "### Companies\n\n| Name | Industry | Domain |\n|------|----------|--------|\n";
      for (const c of matchedCompanies) {
        table += `| ${c.name} | ${c.industry || "—"} | ${c.domain || "—"} |\n`;
      }
      sections.push(table);
    }

    // Search interactions
    const matchedInteractions = await db
      .select()
      .from(interactions)
      .where(
        or(
          like(interactions.summary, q),
          like(interactions.followUp, q)
        )
      )
      .limit(10);

    if (matchedInteractions.length > 0) {
      let table = "### Interactions\n\n| Date | Type | Summary |\n|------|------|--------|\n";
      for (const i of matchedInteractions) {
        table += `| ${i.occurredAt.slice(0, 10)} | ${i.type} | ${i.summary.slice(0, 80)} |\n`;
      }
      sections.push(table);
    }

    if (sections.length === 0) {
      return kit.text(`No results for "${args.query}".`);
    }

    return kit.text(`Search results for "${args.query}":\n\n${sections.join("\n")}`);
  },
});
