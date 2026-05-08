import { z } from "zod";
import { eq, gte, lte, isNull, and, sql } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { expenses, income, settings } from "../schema";
import { resolvePeriod, fmtEur } from "./helpers";

export const vatReport = defineTool({
  name: "vat_report",
  description: "VAT summary for UStVA filing — total collected, deductible input VAT, net liability by rate",
  args: z.object({
    period: z.enum(["Q1", "Q2", "Q3", "Q4", "this_year", "last_year", "this_month", "last_month"]).optional()
      .describe("Period for the VAT report (defaults to current quarter)"),
    from: z.string().optional().describe("Start date (ISO) for custom range"),
    to: z.string().optional().describe("End date (ISO) for custom range"),
  }),
  handler: async (db, args) => {
    // Check Kleinunternehmer mode
    const vatMode = await db.select().from(settings).where(eq(settings.key, "vat_mode")).limit(1);
    const isKleinunternehmer = vatMode.length > 0 && vatMode[0].value === "kleinunternehmer";

    if (isKleinunternehmer) {
      return kit.text(
        "### VAT Report\n\n" +
        "**Kleinunternehmerregelung (§19 UStG) is active.**\n\n" +
        "No VAT is collected or deducted. You are exempt from filing UStVA.\n" +
        "Ensure your annual revenue stays below the threshold (currently €22,000)."
      );
    }

    // Determine period — default to current quarter
    let period = args.period;
    if (!period && !args.from && !args.to) {
      const q = Math.floor(new Date().getMonth() / 3) + 1;
      period = `Q${q}` as "Q1" | "Q2" | "Q3" | "Q4";
    }
    const [start, end] = resolvePeriod(period, args.from, args.to);

    // Income (revenue) for the period
    const incomeTotal = await db
      .select({ total: sql<number>`coalesce(sum(${income.amountCents}), 0)` })
      .from(income)
      .where(and(gte(income.receivedDate, start), lte(income.receivedDate, end)));

    // Expense VAT by rate
    const vatByRate = await db
      .select({
        vatRate: expenses.vatRate,
        totalVat: sql<number>`coalesce(sum(${expenses.vatCents}), 0)`,
        totalNet: sql<number>`coalesce(sum(${expenses.netCents}), 0)`,
        totalGross: sql<number>`coalesce(sum(${expenses.amountCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(and(
        isNull(expenses.archivedAt),
        gte(expenses.expenseDate, start),
        lte(expenses.expenseDate, end),
      ))
      .groupBy(expenses.vatRate);

    const revenue = incomeTotal[0].total;
    // Assume 19% USt on revenue
    const ustCollected = Math.round(revenue - revenue / 1.19);
    const totalVorsteuer = vatByRate.reduce((sum, r) => sum + r.totalVat, 0);
    const zahllast = ustCollected - totalVorsteuer;

    let text = `### VAT Report (${start} to ${end})\n\n`;
    text += `| | Amount |\n|---|--------|\n`;
    text += `| Revenue (gross) | ${fmtEur(revenue)} |\n`;
    text += `| USt collected (19%) | ${fmtEur(ustCollected)} |\n`;
    text += `| **Vorsteuer (input VAT)** | **${fmtEur(totalVorsteuer)}** |\n`;

    if (vatByRate.length > 0) {
      text += `\n#### Vorsteuer by Rate\n\n| Rate | Gross | Net | VAT | Count |\n|------|-------|-----|-----|-------|\n`;
      for (const r of vatByRate) {
        text += `| ${r.vatRate ?? 0}% | ${fmtEur(r.totalGross)} | ${fmtEur(r.totalNet)} | ${fmtEur(r.totalVat)} | ${r.count} |\n`;
      }
    }

    text += `\n| **Zahllast (net VAT liability)** | **${fmtEur(zahllast)}** |\n`;
    if (zahllast > 0) {
      text += `\nYou owe ${fmtEur(zahllast)} to the Finanzamt.`;
    } else {
      text += `\nYou are owed a refund of ${fmtEur(Math.abs(zahllast))}.`;
    }

    return kit.text(text);
  },
});
