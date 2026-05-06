import { z } from "zod";
import { eq, like, isNull, desc, and, SQL } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { contacts, companies } from "../schema";

export const listContacts = defineTool({
  name: "list_contacts",
  description: "List contacts with optional filters",
  args: z.object({
    company: z.string().optional().describe("Filter by company name or ID"),
    relationship: z.string().optional().describe("Filter by relationship: warm, neutral, cold"),
    source: z.string().optional().describe("Filter by source: event, referral, inbound, outbound, linkedin"),
    tag: z.string().optional().describe("Filter by tag (partial match)"),
    limit: z.number().optional().default(25).describe("Max results"),
  }),
  handler: async (db, args) => {
    const conditions: SQL[] = [isNull(contacts.archivedAt)];

    if (args.relationship) {
      conditions.push(eq(contacts.relationship, args.relationship));
    }
    if (args.source) {
      conditions.push(eq(contacts.source, args.source));
    }
    if (args.tag) {
      conditions.push(like(contacts.tags, `%${args.tag}%`));
    }
    if (args.company) {
      if (args.company.startsWith("com_")) {
        conditions.push(eq(contacts.companyId, args.company));
      } else {
        // Resolve company name to ID
        const matched = await db
          .select({ id: companies.id })
          .from(companies)
          .where(like(companies.name, `%${args.company}%`))
          .limit(1);
        if (matched.length > 0) {
          conditions.push(eq(contacts.companyId, matched[0].id));
        }
      }
    }

    const rows = await db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        companyId: contacts.companyId,
        role: contacts.role,
        relationship: contacts.relationship,
        email: contacts.email,
        tags: contacts.tags,
      })
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.createdAt))
      .limit(args.limit);

    if (rows.length === 0) return kit.text("No contacts found.");

    let table = `${rows.length} contact(s):\n\n| Name | Role | Relationship | Email | Tags |\n|------|------|-------------|-------|------|\n`;
    for (const c of rows) {
      const name = `${c.firstName} ${c.lastName || ""}`.trim();
      table += `| ${name} | ${c.role || "—"} | ${c.relationship || "—"} | ${c.email || "—"} | ${c.tags || "—"} |\n`;
    }
    return kit.text(table);
  },
});
