import { z } from "zod";
import { eq, gte, lte, isNull, desc, and, like, SQL } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { expenses } from "../schema";
import { resolvePeriod, fmtEur } from "./helpers";

export const listExpenses = defineTool({
  name: "list_expenses",
  description: "List expenses with filters by period, category, amount range, or vendor",
  args: z.object({
    period: z.enum(["this_month", "last_month", "Q1", "Q2", "Q3", "Q4", "this_year", "last_year"]).optional()
      .describe("Named period filter"),
    from: z.string().optional().describe("Start date (ISO) for custom range"),
    to: z.string().optional().describe("End date (ISO) for custom range"),
    category: z.string().optional().describe("Filter by category"),
    vendor: z.string().optional().describe("Filter by vendor (partial match)"),
    min_amount: z.number().optional().describe("Minimum amount in EUR"),
    max_amount: z.number().optional().describe("Maximum amount in EUR"),
    limit: z.number().optional().default(25).describe("Max results (default 25)"),
  }),
  handler: async (db, args) => {
    const conditions: SQL[] = [isNull(expenses.archivedAt)];

    if (args.period || args.from || args.to) {
      const [start, end] = resolvePeriod(args.period, args.from, args.to);
      conditions.push(gte(expenses.expenseDate, start));
      conditions.push(lte(expenses.expenseDate, end));
    }

    if (args.category) conditions.push(eq(expenses.category, args.category));
    if (args.vendor) conditions.push(like(expenses.vendor, `%${args.vendor}%`));
    if (args.min_amount !== undefined) conditions.push(gte(expenses.amountCents, Math.round(args.min_amount * 100)));
    if (args.max_amount !== undefined) conditions.push(lte(expenses.amountCents, Math.round(args.max_amount * 100)));

    const rows = await db
      .select()
      .from(expenses)
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate))
      .limit(args.limit);

    if (rows.length === 0) return kit.text("No expenses found for the given filters.");

    let table = `${rows.length} expense(s):\n\n| Date | Description | Category | Amount | VAT | Vendor |\n|------|-------------|----------|--------|-----|--------|\n`;
    for (const e of rows) {
      table += `| ${e.expenseDate} | ${e.description} | ${e.category} | ${fmtEur(e.amountCents)} | ${e.vatRate ?? "—"}% | ${e.vendor || "—"} |\n`;
    }
    return kit.text(table);
  },
});
