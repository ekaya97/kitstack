import { defineLoader } from "@kitstackco/sdk";
import { isNull, and, gte, lte, sql } from "drizzle-orm";
import { expenses } from "../../schema";

export const loader = defineLoader(async (db) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

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
    .orderBy(sql`sum(${expenses.amountCents}) desc`);

  return rows;
});
