import { z } from "zod";
import { or, like } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { contacts } from "../schema";

const searchContactsArgs = z.object({
  query: z.string().describe("Search term (matches name or company)"),
});

async function loadSearchResults(db: LibSQLDatabase, args: z.infer<typeof searchContactsArgs>, ctx: KitContext) {
  const pattern = `%${args.query}%`;
  return db
    .select()
    .from(contacts)
    .where(or(like(contacts.name, pattern), like(contacts.company, pattern)));
}

export const searchContacts = defineTool({
  name: "search_contacts",
  description: "Search contacts by name or company",
  args: searchContactsArgs,
  load: loadSearchResults,

  handler: async (db, args, ctx) => {
    const result = await loadSearchResults(db, args, ctx);
    if (result.length === 0) return kit.text(`No contacts matching "${args.query}".`);

    let text = `Found ${result.length} contact(s) for "${args.query}":\n\n`;
    for (const c of result) {
      text += `- **${c.name}**${c.company ? ` (${c.company})` : ""} — ${c.email || "no email"}\n`;
    }
    return kit.text(text);
  },
});
