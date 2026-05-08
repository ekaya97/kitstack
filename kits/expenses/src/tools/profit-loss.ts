import { z } from "zod";
import { gte, lte, isNull, and, sql } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { expenses, income } from "../schema";
import { resolvePeriod, fmtEur } from "./helpers";

export const profitLoss = defineTool({
  name: "profit_loss",
  description: "Simple P&L statement — total income minus total expenses for a period",
  args: z.object({
    period: z.enum(["this_month", "last_month", "Q1", "Q2", "Q3", "Q4", "this_year", "last_year"]).optional()
      .describe("Named period (defaults to current month)"),
    from: z.string().optional().describe("Start date (ISO) for custom range"),
    to: z.string().optional().describe("End date (ISO) for custom range"),
  }),
  handler: async (db, args) => {
    const [start, end] = resolvePeriod(args.period, args.from, args.to);

    const [expResult] = await db
      .select({
        total: sql<number>`coalesce(sum(${expenses.netCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(and(
        isNull(expenses.archivedAt),
        gte(expenses.expenseDate, start),
        lte(expenses.expenseDate, end),
      ));

    const [incResult] = await db
      .select({
        total: sql<number>`coalesce(sum(${income.amountCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(income)
      .where(and(
        gte(income.receivedDate, start),
        lte(income.receivedDate, end),
      ));

    const profit = incResult.total - expResult.total;
    const isProfit = profit >= 0;

    const text = `### Profit & Loss (${start} to ${end})

| | Amount |
|---|--------|
| Revenue | ${fmtEur(incResult.total)} (${incResult.count} entries) |
| Expenses (net) | ${fmtEur(expResult.total)} (${expResult.count} entries) |
| **${isProfit ? "Profit" : "Loss"}** | **${fmtEur(Math.abs(profit))}** |`;

    return kit.text(text);
  },
});
