import { nanoid } from "nanoid";
import { z } from "zod";
import { and, gte, lte } from "drizzle-orm";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { expenses, quarterlySummaries } from "../schema";

export const quarterlySummary = defineTool({
  name: "quarterly_summary",
  description: "Generate and store a quarterly summary of expenses with category breakdown",
  args: z.object({
    year: z.number().describe("Year (e.g., 2026)"),
    quarter: z.number().min(1).max(4).describe("Quarter (1-4)"),
  }),
  handler: async (db, args) => {
    const startMonth = (args.quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const startDate = `${args.year}-${String(startMonth).padStart(2, "0")}-01`;
    const endDay = new Date(args.year, endMonth, 0).getDate();
    const endDate = `${args.year}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const rows = await db
      .select()
      .from(expenses)
      .where(and(gte(expenses.date, startDate), lte(expenses.date, endDate)));

    if (rows.length === 0) {
      return { content: [{ type: "text" as const, text: `No expenses found for Q${args.quarter} ${args.year}.` }] };
    }

    let totalGross = 0;
    let totalNet = 0;
    let totalVat = 0;
    const categoryBreakdown: Record<string, number> = {};
    const flaggedItems: string[] = [];

    for (const row of rows) {
      totalGross += row.amountGross;
      totalNet += row.amountNet ?? 0;
      totalVat += row.vatAmount ?? 0;

      const cat = row.category || "Uncategorized";
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + row.amountGross;

      if (row.needsReceipt && !row.notes?.includes("[receipt:")) {
        flaggedItems.push(`${row.id}: "${row.description}" (€${row.amountGross.toFixed(2)}) — receipt needed`);
      }
      if (row.isPrivate) {
        flaggedItems.push(`${row.id}: "${row.description}" (€${row.amountGross.toFixed(2)}) — marked private`);
      }
      if (!row.category) {
        flaggedItems.push(`${row.id}: "${row.description}" (€${row.amountGross.toFixed(2)}) — uncategorized`);
      }
    }

    const id = nanoid();
    await db.insert(quarterlySummaries).values({
      id,
      year: args.year,
      quarter: args.quarter,
      totalGross: Math.round(totalGross * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      categoryBreakdown,
      flaggedItems,
    });

    let text = `## Q${args.quarter} ${args.year} Summary\n\n`;
    text += `- **Total gross:** €${totalGross.toFixed(2)}\n`;
    text += `- **Total net:** €${totalNet.toFixed(2)}\n`;
    text += `- **Total VAT:** €${totalVat.toFixed(2)}\n`;
    text += `- **Expenses:** ${rows.length}\n\n`;

    text += `### Category Breakdown\n\n| Category | Gross |\n|----------|-------|\n`;
    for (const [cat, amount] of Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])) {
      text += `| ${cat} | €${amount.toFixed(2)} |\n`;
    }

    if (flaggedItems.length > 0) {
      text += `\n### Flagged Items (${flaggedItems.length})\n\n`;
      for (const item of flaggedItems) {
        text += `- ${item}\n`;
      }
    }

    text += `\nSummary saved (ID: ${id}). Reminder: This is not tax advice.`;

    return { content: [{ type: "text" as const, text }] };
  },
});
