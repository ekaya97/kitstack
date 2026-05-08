import { z } from "zod";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { income } from "../schema";

export const addIncome = defineTool({
  name: "add_income",
  description: "Log income received from a client or other source",
  args: z.object({
    amount: z.number().describe("Amount received in EUR (e.g. 3500.00)"),
    source: z.string().describe("Client name or income source"),
    description: z.string().optional().describe("Description of the income"),
    invoice_ref: z.string().optional().describe("Invoice number if applicable"),
    date: z.string().optional().describe("Date received (ISO format, defaults to today)"),
    payment_method: z.enum(["cash", "card", "transfer", "paypal"]).optional().describe("How it was received"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();
    const id = `inc_${nanoid()}`;
    const amountCents = Math.round(args.amount * 100);

    await db.insert(income).values({
      id,
      amountCents,
      currency: "EUR",
      source: args.source,
      description: args.description ?? null,
      invoiceRef: args.invoice_ref ?? null,
      paymentMethod: args.payment_method ?? null,
      receivedDate: args.date ?? now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
    });

    return kit.result(
      kit.created(id, "income", `Income from "${args.source}" logged — ${(amountCents / 100).toFixed(2)} EUR.`)
    );
  },
});
