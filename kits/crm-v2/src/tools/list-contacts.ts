import { z } from "zod";
import { desc, like, eq, isNull, and } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { contacts, companies } from "../schema";

const listContactsArgs = z.object({
  company: z.string().optional().describe("Filter by company name"),
  relationship: z.enum(["warm", "neutral", "cold"]).optional().describe("Filter by relationship warmth"),
  source: z.string().optional().describe("Filter by source"),
  tag: z.string().optional().describe("Filter by tag"),
  limit: z.number().optional().default(25).describe("Max results"),
});

export async function loadContacts(db: LibSQLDatabase, args: z.infer<typeof listContactsArgs>, ctx: KitContext) {
  let query = db.select({
    id: contacts.id,
    firstName: contacts.firstName,
    lastName: contacts.lastName,
    email: contacts.email,
    role: contacts.role,
    relationship: contacts.relationship,
    source: contacts.source,
    companyName: companies.name,
    createdAt: contacts.createdAt,
  })
  .from(contacts)
  .leftJoin(companies, eq(contacts.companyId, companies.id))
  .where(isNull(contacts.archivedAt))
  .orderBy(desc(contacts.createdAt))
  .limit(args.limit);

  return query;
}

export const listContacts = defineTool({
  name: "list_contacts",
  description: "List contacts with optional filters",
  args: listContactsArgs,
  load: loadContacts,
  handler: async (db, args, ctx) => {
    const result = await loadContacts(db, args, ctx);
    if (result.length === 0) return kit.text("No contacts in the CRM yet.");

    let text = `${result.length} contact(s):\n\n`;
    text += "| Name | Company | Role | Relationship | Source |\n";
    text += "|------|---------|------|-------------|--------|\n";
    for (const c of result) {
      const name = `${c.firstName} ${c.lastName ?? ""}`.trim();
      text += `| ${name} | ${c.companyName || "—"} | ${c.role || "—"} | ${c.relationship || "—"} | ${c.source || "—"} |\n`;
    }
    return kit.text(text);
  },
});
