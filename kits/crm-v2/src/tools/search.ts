import { z } from "zod";
import { like, or, isNull, and } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { contacts, companies, interactions } from "../schema";

export const search = defineTool({
  name: "search",
  description: "Full-text search across contacts, companies, and interactions",
  args: z.object({
    query: z.string().describe("Search query (free text)"),
  }),
  handler: async (db, args) => {
    const q = `%${args.query}%`;
    const sections: string[] = [];

    // Search contacts
    const matchedContacts = await db
      .select()
      .from(contacts)
      .where(and(
        isNull(contacts.archivedAt),
        or(
          like(contacts.firstName, q),
          like(contacts.lastName, q),
          like(contacts.email, q),
          like(contacts.notes, q),
          like(contacts.tags, q)
        )
      ))
      .limit(10);

    if (matchedContacts.length > 0) {
      let text = `### Contacts (${matchedContacts.length})\n\n`;
      text += "| Name | Email | Role |\n|------|-------|------|\n";
      for (const c of matchedContacts) {
        const name = `${c.firstName} ${c.lastName ?? ""}`.trim();
        text += `| ${name} | ${c.email || "—"} | ${c.role || "—"} |\n`;
      }
      sections.push(text);
    }

    // Search companies
    const matchedCompanies = await db
      .select()
      .from(companies)
      .where(and(
        isNull(companies.archivedAt),
        or(
          like(companies.name, q),
          like(companies.domain, q),
          like(companies.industry, q),
          like(companies.notes, q)
        )
      ))
      .limit(10);

    if (matchedCompanies.length > 0) {
      let text = `### Companies (${matchedCompanies.length})\n\n`;
      text += "| Name | Industry | Domain |\n|------|----------|--------|\n";
      for (const c of matchedCompanies) {
        text += `| ${c.name} | ${c.industry || "—"} | ${c.domain || "—"} |\n`;
      }
      sections.push(text);
    }

    // Search interactions
    const matchedInteractions = await db
      .select()
      .from(interactions)
      .where(or(
        like(interactions.summary, q),
        like(interactions.followUp, q)
      ))
      .limit(10);

    if (matchedInteractions.length > 0) {
      let text = `### Interactions (${matchedInteractions.length})\n\n`;
      for (const i of matchedInteractions) {
        text += `- [${i.type}] ${i.summary} (${i.occurredAt})\n`;
      }
      sections.push(text);
    }

    if (sections.length === 0) {
      return kit.text(`No results matching "${args.query}".`);
    }

    return kit.text(`## Search: "${args.query}"\n\n${sections.join("\n")}`);
  },
});
