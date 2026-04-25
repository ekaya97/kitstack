import { z } from "zod";
import { desc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { contacts } from "../schema";

const listContactsArgs = z.object({
  limit: z.number().optional().default(25).describe("Max results"),
});

async function loadContacts(db: LibSQLDatabase, args: z.infer<typeof listContactsArgs>, ctx: KitContext) {
  return db
    .select()
    .from(contacts)
    .orderBy(desc(contacts.createdAt))
    .limit(args.limit);
}

export const listContacts = defineTool({
  name: "list_contacts",
  description: "List all contacts in the CRM",
  args: listContactsArgs,
  load: loadContacts,

  handler: async (db, args, ctx) => {
    const result = await loadContacts(db, args, ctx);
    if (result.length === 0) return kit.text("No contacts in the CRM yet.");

    let text = `${result.length} contact(s):\n\n| ID | Name | Company | Email | Source |\n|----|------|---------|-------|--------|\n`;
    for (const c of result) {
      text += `| \`${c.id}\` | ${c.name} | ${c.company || "—"} | ${c.email || "—"} | ${c.source || "—"} |\n`;
    }
    return kit.text(text);
  },
});
