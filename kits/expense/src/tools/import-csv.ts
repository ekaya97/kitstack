import { nanoid } from "nanoid";
import { z } from "zod";
import { defineTool, kit } from "../sdk";
import { expenses } from "../schema";

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
}

function parseCsvRows(csvText: string): ParsedRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const sep = line.includes(";") ? ";" : ",";
    const cols = line.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 3) continue;

    let date = cols[0];
    const description = cols[1];
    let amountStr = cols[cols.length - 1];

    // Normalize German number format (1.234,56 -> 1234.56)
    amountStr = amountStr.replace(/\./g, "").replace(",", ".");
    const amount = parseFloat(amountStr);

    if (isNaN(amount) || !date || !description) continue;

    // Normalize date from DD.MM.YYYY to YYYY-MM-DD
    const dateParts = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dateParts) {
      date = `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}`;
    }

    rows.push({ date, description, amount: Math.abs(amount) });
  }

  return rows;
}

export const importCsv = defineTool({
  name: "import_csv",
  description: "Import expenses from CSV text. Supports common German bank formats (Sparkasse, DKB, ING, N26, generic).",
  args: z.object({
    csvText: z.string().describe("The CSV content as text"),
    defaultVatRate: z.number().optional().default(0.19).describe("Default VAT rate for imported items"),
    source: z.string().optional().default("csv_import").describe("Source label for imported expenses"),
  }),
  handler: async (db, args, ctx) => {
    const rows = parseCsvRows(args.csvText);

    if (rows.length === 0) {
      return kit.error("No valid rows found in the CSV. Expected columns: date, description, amount.");
    }

    let imported = 0;
    for (const row of rows) {
      const id = nanoid();
      const amountNet = row.amount / (1 + args.defaultVatRate);
      const vatAmount = row.amount - amountNet;

      await db.insert(expenses).values({
        id,
        date: row.date,
        description: row.description,
        amountGross: row.amount,
        amountNet: Math.round(amountNet * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        vatRate: args.defaultVatRate,
        category: null,
        skr03Account: null,
        isPrivate: false,
        needsReceipt: row.amount > 250,
        notes: null,
        source: args.source,
      });
      imported++;
    }

    return kit.text(
      `Imported ${imported} expense(s) from CSV. All items need categorization — use the categorize tool next.\n\nReminder: This is not tax advice. Verify with your Steuerberater.`
    );
  },
});
