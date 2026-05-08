import { z } from "zod";
import { eq, gte, lte, desc, and, like, SQL } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { income } from "../schema";
import { resolvePeriod, fmtEur } from "./helpers";

export const listIncome = defineTool({
  name: "list_income",
  description: "List income entries with filters by period or source",
  args: z.object({
    period: z.enum(["this_month", "last_month", "Q1", "Q2", "Q3", "Q4", "this_year", "last_year"]).optional()
      .describe("Named period filter"),
    from: z.string().optional().describe("Start date (ISO) for custom range"),
    to: z.string().optional().describe("End date (ISO) for custom range"),
    source: z.string().optional().describe("Filter by source (partial match)"),
    limit: z.number().optional().default(25).describe("Max results (default 25)"),
  }),
  handler: async (db, args) => {
    const conditions: SQL[] = [];

    if (args.period || args.from || args.to) {
      const [start, end] = resolvePeriod(args.period, args.from, args.to);
      conditions.push(gte(income.receivedDate, start));
      conditions.push(lte(income.receivedDate, end));
    }

    if (args.source) conditions.push(like(income.source, `%${args.source}%`));

    const rows = await db
      .select()
      .from(income)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(income.receivedDate))
      .limit(args.limit);

    if (rows.length === 0) return kit.text("No income entries found.");

    let table = `${rows.length} income entry/entries:\n\n| Date | Source | Description | Amount | Invoice |\n|------|--------|-------------|--------|--------|\n`;
    for (const i of rows) {
      table += `| ${i.receivedDate} | ${i.source} | ${i.description || "—"} | ${fmtEur(i.amountCents)} | ${i.invoiceRef || "—"} |\n`;
    }
    return kit.text(table);
  },
});
