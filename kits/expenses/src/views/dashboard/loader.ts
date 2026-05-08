import { defineLoader } from "@kitstackco/sdk";
import { isNull, gte, desc, sql } from "drizzle-orm";
import { expenses, income } from "../../schema";

function localIso(year: number, month: number, day: number): string {
  const d = new Date(year, month, day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const loader = defineLoader(async (db) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStart = localIso(y, m, 1);
  const monthEnd = localIso(y, m + 1, 0);

  // Current month expenses
  const [monthExpenses] = await db
    .select({
      total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(expenses)
    .where(sql`${expenses.archivedAt} is null and ${expenses.expenseDate} >= ${monthStart} and ${expenses.expenseDate} <= ${monthEnd}`);

  // Current month income
  const [monthIncome] = await db
    .select({
      total: sql<number>`coalesce(sum(${income.amountCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(income)
    .where(sql`${income.receivedDate} >= ${monthStart} and ${income.receivedDate} <= ${monthEnd}`);

  // Last 6 months spending trend
  const trend: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - i, 1);
    const s = localIso(d.getFullYear(), d.getMonth(), 1);
    const e = localIso(d.getFullYear(), d.getMonth() + 1, 0);
    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)` })
      .from(expenses)
      .where(sql`${expenses.archivedAt} is null and ${expenses.expenseDate} >= ${s} and ${expenses.expenseDate} <= ${e}`);
    trend.push({
      month: d.toLocaleDateString("en", { month: "short" }),
      total: row.total,
    });
  }

  // Category breakdown (current month)
  const categoryBreakdown = await db
    .select({
      category: expenses.category,
      total: sql<number>`sum(${expenses.amountCents})`,
    })
    .from(expenses)
    .where(sql`${expenses.archivedAt} is null and ${expenses.expenseDate} >= ${monthStart} and ${expenses.expenseDate} <= ${monthEnd}`)
    .groupBy(expenses.category)
    .orderBy(desc(sql`sum(${expenses.amountCents})`))
    .limit(8);

  // Recent transactions
  const recentExpenses = await db
    .select({
      id: expenses.id,
      type: sql<string>`'expense'`,
      date: expenses.expenseDate,
      description: expenses.description,
      amountCents: expenses.amountCents,
      category: expenses.category,
    })
    .from(expenses)
    .where(isNull(expenses.archivedAt))
    .orderBy(desc(expenses.expenseDate))
    .limit(10);

  return {
    monthExpenses: monthExpenses.total,
    monthIncome: monthIncome.total,
    profit: monthIncome.total - monthExpenses.total,
    trend,
    categoryBreakdown,
    recentExpenses,
  };
});
