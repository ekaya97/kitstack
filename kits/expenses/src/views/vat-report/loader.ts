import { defineLoader } from "@kitstackco/sdk";
import { eq, gte, lte, sql } from "drizzle-orm";
import { expenses, income, settings } from "../../schema";

export const loader = defineLoader(async (db) => {
  // Check VAT mode
  const vatMode = await db.select().from(settings).where(eq(settings.key, "vat_mode")).limit(1);
  const isKleinunternehmer = vatMode.length > 0 && vatMode[0].value === "kleinunternehmer";

  // Current quarter
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const qStartDate = new Date(now.getFullYear(), q * 3, 1);
  const qEndDate = new Date(now.getFullYear(), q * 3 + 3, 0);
  const qStart = `${qStartDate.getFullYear()}-${String(qStartDate.getMonth() + 1).padStart(2, "0")}-${String(qStartDate.getDate()).padStart(2, "0")}`;
  const qEnd = `${qEndDate.getFullYear()}-${String(qEndDate.getMonth() + 1).padStart(2, "0")}-${String(qEndDate.getDate()).padStart(2, "0")}`;
  const quarterLabel = `Q${q + 1} ${now.getFullYear()}`;

  if (isKleinunternehmer) {
    return { isKleinunternehmer: true, quarterLabel, revenue: 0, ustCollected: 0, vorsteuer: [], totalVorsteuer: 0, zahllast: 0 };
  }

  // Revenue
  const [incRow] = await db
    .select({ total: sql<number>`coalesce(sum(${income.amountCents}), 0)` })
    .from(income)
    .where(sql`${income.receivedDate} >= ${qStart} and ${income.receivedDate} <= ${qEnd}`);

  const revenue = incRow.total;
  const ustCollected = Math.round(revenue - revenue / 1.19);

  // Vorsteuer by rate
  const vorsteuer = await db
    .select({
      vatRate: expenses.vatRate,
      totalVat: sql<number>`coalesce(sum(${expenses.vatCents}), 0)`,
      totalNet: sql<number>`coalesce(sum(${expenses.netCents}), 0)`,
      totalGross: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(expenses)
    .where(sql`${expenses.archivedAt} is null and ${expenses.expenseDate} >= ${qStart} and ${expenses.expenseDate} <= ${qEnd}`)
    .groupBy(expenses.vatRate);

  const totalVorsteuer = vorsteuer.reduce((s, r) => s + r.totalVat, 0);
  const zahllast = ustCollected - totalVorsteuer;

  return { isKleinunternehmer: false, quarterLabel, revenue, ustCollected, vorsteuer, totalVorsteuer, zahllast };
});
