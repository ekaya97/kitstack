import { z } from "zod";
import { gte, lte, isNull, and, desc, sql } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { expenses } from "../schema";
import { resolvePeriod, fmtEur } from "./helpers";

export const byCategory = defineTool({
  name: "by_category",
  description: "Breakdown of expenses by category for a period — shows totals and percentages",
  args: z.object({
    period: z.enum(["this_month", "last_month", "Q1", "Q2", "Q3", "Q4", "this_year", "last_year"]).optional()
      .describe("Named period (defaults to current month)"),
    from: z.string().optional().describe("Start date (ISO) for custom range"),
    to: z.string().optional().describe("End date (ISO) for custom range"),
  }),
  handler: async (db, args) => {
    const [start, end] = resolvePeriod(args.period, args.from, args.to);

    const rows = await db
      .select({
        category: expenses.category,
        total: sql<number>`sum(${expenses.amountCents})`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(and(
        isNull(expenses.archivedAt),
        gte(expenses.expenseDate, start),
        lte(expenses.expenseDate, end),
      ))
      .groupBy(expenses.category)
      .orderBy(desc(sql`sum(${expenses.amountCents})`));

    if (rows.length === 0) return kit.text("No expenses found for the given period.");

    const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

    let table = `### Expenses by Category (${start} to ${end})\n\n| Category | Amount | % | Count |\n|----------|--------|---|-------|\n`;
    for (const r of rows) {
      const pct = grandTotal > 0 ? ((r.total / grandTotal) * 100).toFixed(1) : "0.0";
      table += `| ${r.category} | ${fmtEur(r.total)} | ${pct}% | ${r.count} |\n`;
    }
    table += `| **Total** | **${fmtEur(grandTotal)}** | 100% | ${rows.reduce((s, r) => s + r.count, 0)} |\n`;

    return kit.text(table);
  },
});
