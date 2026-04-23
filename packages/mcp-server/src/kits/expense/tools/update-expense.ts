import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { expenses } from "../schema";

export const updateExpense = defineTool({
  name: "update_expense",
  description: "Update an expense's details (category, SKR03 account, VAT rate, notes, etc.)",
  args: z.object({
    expenseId: z.string().describe("Expense ID"),
    description: z.string().optional().describe("Updated description"),
    category: z.string().optional().describe("Expense category"),
    skr03Account: z.string().optional().describe("SKR03 account number"),
    vatRate: z.number().optional().describe("VAT rate (0, 0.07, or 0.19)"),
    isPrivate: z.boolean().optional().describe("Whether this is a private expense"),
    needsReceipt: z.boolean().optional().describe("Whether a receipt is needed"),
    notes: z.string().optional().describe("Notes"),
  }),
  handler: async (db, args) => {
    const existing = await db.select().from(expenses).where(eq(expenses.id, args.expenseId)).then((r: any[]) => r[0]);
    if (!existing) {
      return { content: [{ type: "text" as const, text: "Expense not found." }], isError: true };
    }

    const updates: Record<string, unknown> = {};
    if (args.description !== undefined) updates.description = args.description;
    if (args.category !== undefined) updates.category = args.category;
    if (args.skr03Account !== undefined) updates.skr03Account = args.skr03Account;
    if (args.isPrivate !== undefined) updates.isPrivate = args.isPrivate;
    if (args.needsReceipt !== undefined) updates.needsReceipt = args.needsReceipt;
    if (args.notes !== undefined) updates.notes = args.notes;

    // Recalculate VAT if rate changes
    if (args.vatRate !== undefined) {
      updates.vatRate = args.vatRate;
      const amountNet = existing.amountGross / (1 + args.vatRate);
      updates.amountNet = Math.round(amountNet * 100) / 100;
      updates.vatAmount = Math.round((existing.amountGross - amountNet) * 100) / 100;
    }

    if (Object.keys(updates).length === 0) {
      return { content: [{ type: "text" as const, text: "No changes specified." }] };
    }

    await db.update(expenses).set(updates).where(eq(expenses.id, args.expenseId));

    const changes = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(", ");
    return {
      content: [{ type: "text" as const, text: `Expense "${existing.description}" updated — ${changes}.` }],
    };
  },
});
