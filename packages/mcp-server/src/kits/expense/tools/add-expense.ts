import { nanoid } from "nanoid";
import { z } from "zod";
import { defineTool } from "../../../framework";
import { expenses } from "../schema";

export const addExpense = defineTool({
  name: "add_expense",
  description: "Add a single expense. Auto-calculates VAT fields if only gross amount is provided (default 19%).",
  args: z.object({
    date: z.string().describe("Expense date (YYYY-MM-DD)"),
    description: z.string().describe("What the expense is for"),
    amountGross: z.number().describe("Gross amount in EUR"),
    vatRate: z.number().optional().default(0.19).describe("VAT rate (0, 0.07, or 0.19). Defaults to 0.19"),
    category: z.string().optional().describe("Expense category (e.g., 'Software', 'Office', 'Travel')"),
    skr03Account: z.string().optional().describe("SKR03 account number (e.g., '4946' for Software)"),
    isPrivate: z.boolean().optional().default(false).describe("Whether this may be a private expense"),
    notes: z.string().optional().describe("Additional notes"),
    source: z.string().optional().describe("Source of the expense (e.g., 'manual', 'csv_import')"),
  }),
  handler: async (db, args) => {
    const id = nanoid();
    const amountNet = args.amountGross / (1 + args.vatRate);
    const vatAmount = args.amountGross - amountNet;
    const needsReceipt = args.amountGross > 250;

    await db.insert(expenses).values({
      id,
      date: args.date,
      description: args.description,
      amountGross: args.amountGross,
      amountNet: Math.round(amountNet * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      vatRate: args.vatRate,
      category: args.category ?? null,
      skr03Account: args.skr03Account ?? null,
      isPrivate: args.isPrivate,
      needsReceipt,
      notes: args.notes ?? null,
      source: args.source ?? "manual",
    });

    const receiptNote = needsReceipt ? " (receipt required)" : "";
    return {
      content: [{ type: "text" as const, text: `Expense added: "${args.description}" — €${args.amountGross.toFixed(2)} gross (€${Math.round(amountNet * 100) / 100} net, ${(args.vatRate * 100).toFixed(0)}% VAT)${receiptNote}. ID: ${id}\n\nReminder: This is not tax advice. Verify with your Steuerberater.` }],
    };
  },
});
