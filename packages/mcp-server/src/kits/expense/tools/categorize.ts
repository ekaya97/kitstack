import { z } from "zod";
import { isNull, eq } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { expenses } from "../schema";

const CATEGORY_RULES: Array<{ pattern: RegExp; category: string; skr03: string }> = [
  { pattern: /miete|rent|office\s*space/i, category: "Miete", skr03: "4210" },
  { pattern: /strom|electricity|energy|gas/i, category: "Raumkosten", skr03: "4200" },
  { pattern: /software|saas|cloud|hosting|server|domain|aws|azure|google cloud/i, category: "Software/Cloud", skr03: "4946" },
  { pattern: /werbung|marketing|ads|google ads|facebook|linkedin|advertisement/i, category: "Werbekosten", skr03: "4600" },
  { pattern: /fahrt|fuel|tank|benzin|diesel|auto|car|vehicle|taxi|uber|bahn|train|flug|flight/i, category: "Fahrzeug/Reise", skr03: "4500" },
  { pattern: /telefon|phone|mobile|internet|telekom|vodafone|o2/i, category: "Telekommunikation", skr03: "4920" },
  { pattern: /versicherung|insurance/i, category: "Versicherung", skr03: "4360" },
  { pattern: /buro|office|schreib|paper|printer|toner|stationery/i, category: "Burobedarf", skr03: "4930" },
  { pattern: /beratung|consulting|steuerberater|rechtsanwalt|lawyer|legal|audit/i, category: "Beratung", skr03: "4950" },
  { pattern: /fortbildung|training|course|seminar|conference|workshop/i, category: "Fortbildung", skr03: "4945" },
];

export const categorize = defineTool({
  name: "categorize",
  description: "Auto-categorize uncategorized expenses by matching descriptions to common German business categories and SKR03 accounts",
  args: z.object({
    expenseId: z.string().optional().describe("Categorize a specific expense by ID. If omitted, categorizes all uncategorized expenses."),
  }),
  handler: async (db, args) => {
    let rows;
    if (args.expenseId) {
      rows = await db.select().from(expenses).where(eq(expenses.id, args.expenseId));
    } else {
      rows = await db.select().from(expenses).where(isNull(expenses.category));
    }

    if (rows.length === 0) {
      return { content: [{ type: "text" as const, text: args.expenseId ? "Expense not found or already categorized." : "No uncategorized expenses found." }] };
    }

    let categorized = 0;
    let uncategorized = 0;
    const results: string[] = [];

    for (const row of rows) {
      const match = CATEGORY_RULES.find((r) => r.pattern.test(row.description));
      if (match) {
        await db
          .update(expenses)
          .set({ category: match.category, skr03Account: match.skr03 })
          .where(eq(expenses.id, row.id));
        categorized++;
        results.push(`- "${row.description}" -> ${match.category} (SKR03: ${match.skr03})`);
      } else {
        uncategorized++;
        results.push(`- "${row.description}" -> could not auto-categorize`);
      }
    }

    let text = `Categorized ${categorized} of ${rows.length} expense(s).\n\n${results.join("\n")}`;
    if (uncategorized > 0) {
      text += `\n\n${uncategorized} item(s) need manual categorization. Use update_expense to set their category and SKR03 account.`;
    }
    text += "\n\nReminder: Verify all categorizations with your Steuerberater.";

    return { content: [{ type: "text" as const, text }] };
  },
});
