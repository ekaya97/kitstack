import { z } from "zod";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { contacts, deals } from "../schema";

const exportArgs = z.object({
  type: z.enum(["contacts", "deals"]).describe("What to export"),
});

async function loadExportData(db: LibSQLDatabase, args: z.infer<typeof exportArgs>, ctx: KitContext) {
  if (args.type === "contacts") {
    return { type: "contacts" as const, rows: await db.select().from(contacts) };
  }
  return { type: "deals" as const, rows: await db.select().from(deals) };
}

export const exportData = defineTool({
  name: "export",
  description: "Export contacts and deals as CSV-formatted text",
  args: exportArgs,
  load: loadExportData,

  handler: async (db, args, ctx) => {
    const data = await loadExportData(db, args, ctx);
    if (data.rows.length === 0) return kit.text(`No ${data.type} to export.`);

    if (data.type === "contacts") {
      let csv = "id,name,company,email,phone,source,last_contacted_at\n";
      for (const c of data.rows) {
        csv += `"${c.id}","${c.name}","${c.company || ""}","${c.email || ""}","${c.phone || ""}","${c.source || ""}","${c.lastContactedAt || ""}"\n`;
      }
      return kit.text(`## Contacts Export (${data.rows.length} rows)\n\n\`\`\`csv\n${csv}\`\`\``);
    }

    let csv = "id,name,contact_id,value,currency,stage,expected_close_date\n";
    for (const d of data.rows) {
      csv += `"${d.id}","${d.name}","${d.contactId || ""}","${d.value || ""}","${d.currency}","${d.stage}","${d.expectedCloseDate || ""}"\n`;
    }
    return kit.text(`## Deals Export (${data.rows.length} rows)\n\n\`\`\`csv\n${csv}\`\`\``);
  },
});
