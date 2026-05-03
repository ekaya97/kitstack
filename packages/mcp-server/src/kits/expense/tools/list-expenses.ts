import { z } from "zod";
import { desc, and, gte, lte, eq } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { expenses } from "../schema";

export const listExpenses = defineTool({
  name: "list_expenses",
  description: "List expenses with optional filters (date range, category)",
  args: z.object({
    startDate: z.string().optional().describe("Filter from date (YYYY-MM-DD)"),
    endDate: z.string().optional().describe("Filter to date (YYYY-MM-DD)"),
    category: z.string().optional().describe("Filter by category"),
    limit: z.number().optional().default(50).describe("Max results"),
  }),
  handler: async (db, args) => {
    const conditions = [];
    if (args.startDate) conditions.push(gte(expenses.date, args.startDate));
    if (args.endDate) conditions.push(lte(expenses.date, args.endDate));
    if (args.category) conditions.push(eq(expenses.category, args.category));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select()
      .from(expenses)
      .where(where)
      .orderBy(desc(expenses.date))
      .limit(args.limit);

    if (result.length === 0) {
      return { content: [{ type: "text" as const, text: "No expenses found matching the filters." }] };
    }

    let totalGross = 0;
    let text = `${result.length} expense(s):\n\n| Date | Description | Gross | Net | VAT | Category | SKR03 |\n|------|-------------|-------|-----|-----|----------|-------|\n`;
    for (const e of result) {
      totalGross += e.amountGross;
      text += `| ${e.date} | ${e.description} | €${e.amountGross.toFixed(2)} | €${(e.amountNet ?? 0).toFixed(2)} | ${((e.vatRate ?? 0) * 100).toFixed(0)}% | ${e.category || "—"} | ${e.skr03Account || "—"} |\n`;
    }
    text += `\n**Total gross: €${totalGross.toFixed(2)}**`;

    return { content: [{ type: "text" as const, text }] };
  },
});
