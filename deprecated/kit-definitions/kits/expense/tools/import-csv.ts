import { nanoid } from "nanoid";
import { z } from "zod";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { expenses } from "../schema";

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
}

function parseCsvRows(csvText: string): ParsedRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const rows: ParsedRow[] = [];

  // Detect format by header content
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split by semicolon (German CSV) or comma
    const sep = line.includes(";") ? ";" : ",";
    const cols = line.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());

    if (cols.length < 3) continue;

    // Try to extract date, description, amount from common formats
    // Generic: date, description, amount
    // Sparkasse-like: date, ..., description, ..., amount
    // DKB-like: date, ..., description, amount
    let date = cols[0];
    let description = cols[1];
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
  description: "Import expenses from CSV text. Supports common German bank formats (Sparkasse, DKB, ING, N26, generic). Expects columns for date, description, and amount.",
  args: z.object({
    csvText: z.string().describe("The CSV content as text"),
    defaultVatRate: z.number().optional().default(0.19).describe("Default VAT rate for imported items"),
    source: z.string().optional().default("csv_import").describe("Source label for imported expenses"),
  }),
  handler: async (db, args) => {
    const rows = parseCsvRows(args.csvText);

    if (rows.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No valid rows found in the CSV. Expected columns: date, description, amount." }],
        isError: true,
      };
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

    return {
      content: [{ type: "text" as const, text: `Imported ${imported} expense(s) from CSV. All items need categorization — use the categorize tool next.\n\nReminder: This is not tax advice. Verify with your Steuerberater.` }],
    };
  },
});
