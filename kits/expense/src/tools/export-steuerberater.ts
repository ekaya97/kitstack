import { z } from "zod";
import { and, gte, lte, desc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { expenses } from "../schema";

const exportArgs = z.object({
  startDate: z.string().describe("Start date (YYYY-MM-DD)"),
  endDate: z.string().describe("End date (YYYY-MM-DD)"),
});

async function loadExportData(db: LibSQLDatabase, args: z.infer<typeof exportArgs>, ctx: KitContext) {
  return db
    .select()
    .from(expenses)
    .where(and(gte(expenses.date, args.startDate), lte(expenses.date, args.endDate)))
    .orderBy(desc(expenses.date));
}

export const exportSteuerberater = defineTool({
  name: "export_steuerberater",
  description: "Export expenses formatted for Steuerberater (German tax advisor) as CSV with all required fields",
  args: exportArgs,
  load: loadExportData,

  handler: async (db, args, ctx) => {
    const rows = await loadExportData(db, args, ctx);
    if (rows.length === 0) {
      return kit.text(`No expenses found between ${args.startDate} and ${args.endDate}.`);
    }

    let csv = "Datum,Beschreibung,Brutto,Netto,MwSt-Betrag,MwSt-Satz,Kategorie,SKR03-Konto,Privat,Beleg vorhanden\n";

    for (const e of rows) {
      const vatPct = e.vatRate !== null ? `${(e.vatRate * 100).toFixed(0)}%` : "";
      const isPrivate = e.isPrivate ? "Ja" : "Nein";
      const receipt = e.needsReceipt ? (e.notes?.includes("[receipt:") ? "Ja" : "Ausstehend") : "Nicht erforderlich";
      csv += `"${e.date}","${e.description}","${e.amountGross.toFixed(2)}","${(e.amountNet ?? 0).toFixed(2)}","${(e.vatAmount ?? 0).toFixed(2)}","${vatPct}","${e.category || ""}","${e.skr03Account || ""}","${isPrivate}","${receipt}"\n`;
    }

    let totalGross = 0;
    let totalVat = 0;
    for (const e of rows) {
      totalGross += e.amountGross;
      totalVat += e.vatAmount ?? 0;
    }

    let text = `## Steuerberater Export (${args.startDate} to ${args.endDate})\n\n`;
    text += `**${rows.length} expenses** | Total gross: €${totalGross.toFixed(2)} | Total VAT: €${totalVat.toFixed(2)}\n\n`;
    text += `\`\`\`csv\n${csv}\`\`\``;
    text += `\n\nReminder: This export is for organizational purposes only — not tax advice.`;

    return kit.text(text);
  },
});
