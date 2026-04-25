import { z } from "zod";
import { defineTool, kit } from "../sdk";
import { contacts, deals } from "../schema";

export const exportData = defineTool({
  name: "export",
  description: "Export contacts and deals as CSV-formatted text",
  args: z.object({
    type: z.enum(["contacts", "deals"]).describe("What to export"),
  }),
  handler: async (db, args, ctx) => {
    if (args.type === "contacts") {
      const all = await db.select().from(contacts);
      if (all.length === 0) return kit.text("No contacts to export.");

      let csv = "id,name,company,email,phone,source,last_contacted_at\n";
      for (const c of all) {
        csv += `"${c.id}","${c.name}","${c.company || ""}","${c.email || ""}","${c.phone || ""}","${c.source || ""}","${c.lastContactedAt || ""}"\n`;
      }
      return kit.text(`## Contacts Export (${all.length} rows)\n\n\`\`\`csv\n${csv}\`\`\``);
    }

    const all = await db.select().from(deals);
    if (all.length === 0) return kit.text("No deals to export.");

    let csv = "id,name,contact_id,value,currency,stage,expected_close_date\n";
    for (const d of all) {
      csv += `"${d.id}","${d.name}","${d.contactId || ""}","${d.value || ""}","${d.currency}","${d.stage}","${d.expectedCloseDate || ""}"\n`;
    }
    return kit.text(`## Deals Export (${all.length} rows)\n\n\`\`\`csv\n${csv}\`\`\``);
  },
});
