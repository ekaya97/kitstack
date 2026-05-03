import { z } from "zod";
import { like, or } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { contacts } from "../schema";

export const searchContacts = defineTool({
  name: "search_contacts",
  description: "Search contacts by name or company",
  args: z.object({
    query: z.string().describe("Search term (matches name or company)"),
  }),
  handler: async (db, args) => {
    const pattern = `%${args.query}%`;
    const result = await db
      .select()
      .from(contacts)
      .where(or(like(contacts.name, pattern), like(contacts.company, pattern)));

    if (result.length === 0) {
      return { content: [{ type: "text" as const, text: `No contacts matching "${args.query}".` }] };
    }

    let text = `Found ${result.length} contact(s) for "${args.query}":\n\n`;
    for (const c of result) {
      text += `- **${c.name}**${c.company ? ` (${c.company})` : ""} — ${c.email || "no email"}\n`;
    }
    return { content: [{ type: "text" as const, text }] };
  },
});
