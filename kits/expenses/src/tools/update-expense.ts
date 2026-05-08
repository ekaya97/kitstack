import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { expenses } from "../schema";
import { computeVat } from "./helpers";

export const updateExpense = defineTool({
  name: "update_expense",
  description: "Modify an existing expense — update amount, category, vendor, date, or any other field",
  args: z.object({
    id: z.string().describe("Expense ID (exp_xxx)"),
    amount: z.number().optional().describe("New gross amount in EUR"),
    description: z.string().optional().describe("Updated description"),
    category: z.string().optional().describe("Updated category"),
    subcategory: z.string().optional().describe("Updated subcategory"),
    vendor: z.string().optional().describe("Updated vendor"),
    date: z.string().optional().describe("Updated expense date (ISO)"),
    vat_rate: z.number().optional().describe("Updated VAT rate (0, 7, 19)"),
    payment_method: z.enum(["cash", "card", "transfer", "paypal"]).optional().describe("Updated payment method"),
    is_deductible: z.boolean().optional().describe("Updated deductibility"),
    receipt_note: z.string().optional().describe("Updated receipt note"),
    tags: z.string().optional().describe("Updated tags"),
  }),
  handler: async (db, args) => {
    const existing = await db.select().from(expenses).where(eq(expenses.id, args.id)).limit(1);
    if (existing.length === 0) return kit.notFound("expense", args.id);

    const row = existing[0];
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (args.description !== undefined) updates.description = args.description;
    if (args.category !== undefined) updates.category = args.category;
    if (args.subcategory !== undefined) updates.subcategory = args.subcategory;
    if (args.vendor !== undefined) updates.vendor = args.vendor;
    if (args.date !== undefined) updates.expenseDate = args.date;
    if (args.payment_method !== undefined) updates.paymentMethod = args.payment_method;
    if (args.is_deductible !== undefined) updates.isDeductible = args.is_deductible ? 1 : 0;
    if (args.receipt_note !== undefined) updates.receiptNote = args.receipt_note;
    if (args.tags !== undefined) updates.tags = args.tags;

    // Recompute VAT if amount or rate changed
    const newAmount = args.amount !== undefined ? Math.round(args.amount * 100) : row.amountCents;
    const newRate = args.vat_rate !== undefined ? args.vat_rate : row.vatRate ?? 19;

    if (args.amount !== undefined || args.vat_rate !== undefined) {
      const { netCents, vatCents } = computeVat(newAmount, newRate);
      updates.amountCents = newAmount;
      updates.vatRate = newRate;
      updates.netCents = netCents;
      updates.vatCents = vatCents;
    }

    await db.update(expenses).set(updates).where(eq(expenses.id, args.id));

    const changed = Object.keys(updates).filter((k) => k !== "updatedAt").join(", ");
    return kit.result(kit.updated(args.id, "expense", `Expense updated: ${changed}.`));
  },
});
