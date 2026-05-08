import { z } from "zod";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { expenses, settings } from "../schema";
import { computeVat } from "./helpers";

export const addExpense = defineTool({
  name: "add_expense",
  description: "Log an expense — auto-computes VAT (net/gross split) based on user's VAT mode and rate",
  args: z.object({
    amount: z.number().describe("Gross amount in EUR (e.g. 47.50)"),
    description: z.string().describe("What the expense was for"),
    category: z.string().describe("Category: office_supplies, software, hardware, travel, meals_business, meals_personal, phone_internet, advertising, education, insurance, rent, professional_services, transport, misc"),
    vendor: z.string().optional().describe("Vendor or merchant name"),
    date: z.string().optional().describe("Expense date (ISO format, defaults to today)"),
    vat_rate: z.number().optional().describe("VAT percentage (0, 7, or 19). Auto-detected from settings if omitted"),
    payment_method: z.enum(["cash", "card", "transfer", "paypal"]).optional().describe("How it was paid"),
    subcategory: z.string().optional().describe("More specific sub-category"),
    is_deductible: z.boolean().optional().default(true).describe("Tax-deductible (default: true)"),
    receipt_note: z.string().optional().describe("Note about the receipt"),
    tags: z.string().optional().describe("Comma-separated tags"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();
    const id = `exp_${nanoid()}`;
    const amountCents = Math.round(args.amount * 100);

    // Determine VAT rate
    let vatRate = args.vat_rate;
    if (vatRate === undefined) {
      const vatMode = await db.select().from(settings).where(eq(settings.key, "vat_mode")).limit(1);
      vatRate = vatMode.length > 0 && vatMode[0].value === "kleinunternehmer" ? 0 : 19;
    }

    const { netCents, vatCents } = computeVat(amountCents, vatRate);

    await db.insert(expenses).values({
      id,
      amountCents,
      currency: "EUR",
      vatRate,
      netCents,
      vatCents,
      category: args.category,
      subcategory: args.subcategory ?? null,
      description: args.description,
      vendor: args.vendor ?? null,
      paymentMethod: args.payment_method ?? null,
      isDeductible: args.is_deductible ? 1 : 0,
      receiptNote: args.receipt_note ?? null,
      tags: args.tags ?? null,
      expenseDate: args.date ?? now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
    });

    return kit.result(
      kit.created(id, "expense", `Expense "${args.description}" logged — ${(amountCents / 100).toFixed(2)} EUR (net ${(netCents / 100).toFixed(2)}, VAT ${vatRate}%).`)
    );
  },
});
