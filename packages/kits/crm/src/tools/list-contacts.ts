import { z } from "zod";
import { desc } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { contacts } from "../schema";

export const listContacts = defineTool({
  name: "list_contacts",
  description: "List all contacts in the CRM",
  args: z.object({
    limit: z.number().optional().default(25).describe("Max results"),
  }),
  handler: async (db, args, ctx) => {
    const result = await db
      .select()
      .from(contacts)
      .orderBy(desc(contacts.createdAt))
      .limit(args.limit);

    if (result.length === 0) {
      return kit.text("No contacts in the CRM yet.");
    }

    let text = `${result.length} contact(s):\n\n| ID | Name | Company | Email | Source |\n|----|------|---------|-------|--------|\n`;
    for (const c of result) {
      text += `| \`${c.id}\` | ${c.name} | ${c.company || "—"} | ${c.email || "—"} | ${c.source || "—"} |\n`;
    }
    return kit.text(text);
  },
});
