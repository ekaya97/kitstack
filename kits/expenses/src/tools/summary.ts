import { z } from "zod";
import { gte, lte, isNull, and, sql } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { expenses, income } from "../schema";
import { resolvePeriod, fmtEur } from "./helpers";

export const summary = defineTool({
  name: "summary",
  description: "Financial summary for a period — total expenses, income, and balance",
  args: z.object({
    period: z.enum(["this_month", "last_month", "Q1", "Q2", "Q3", "Q4", "this_year", "last_year"]).optional()
      .describe("Named period (defaults to current month)"),
    from: z.string().optional().describe("Start date (ISO) for custom range"),
    to: z.string().optional().describe("End date (ISO) for custom range"),
  }),
  handler: async (db, args) => {
    const [start, end] = resolvePeriod(args.period, args.from, args.to);

    const expenseRows = await db
      .select({
        total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`,
        count: sql<number>`count(*)`,
        totalNet: sql<number>`coalesce(sum(${expenses.netCents}), 0)`,
        totalVat: sql<number>`coalesce(sum(${expenses.vatCents}), 0)`,
      })
      .from(expenses)
      .where(and(
        isNull(expenses.archivedAt),
        gte(expenses.expenseDate, start),
        lte(expenses.expenseDate, end),
      ));

    const incomeRows = await db
      .select({
        total: sql<number>`coalesce(sum(${income.amountCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(income)
      .where(and(
        gte(income.receivedDate, start),
        lte(income.receivedDate, end),
      ));

    const exp = expenseRows[0];
    const inc = incomeRows[0];
    const balance = inc.total - exp.total;

    const text = `### Financial Summary (${start} to ${end})

| | Amount |
|---|--------|
| **Total Income** | ${fmtEur(inc.total)} (${inc.count} entries) |
| **Total Expenses** | ${fmtEur(exp.total)} (${exp.count} entries) |
| Net (expenses) | ${fmtEur(exp.totalNet)} |
| VAT (expenses) | ${fmtEur(exp.totalVat)} |
| **Balance** | ${fmtEur(balance)} |`;

    return kit.text(text);
  },
});
