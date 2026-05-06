import { z } from "zod";
import { eq, gte, lte, isNull, desc, and, SQL } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { deals } from "../schema";

export const listDeals = defineTool({
  name: "list_deals",
  description: "List deals with optional filters",
  args: z.object({
    stage: z.string().optional().describe("Filter by stage: lead, contacted, proposal, negotiation, won, lost"),
    contact_id: z.string().optional().describe("Filter by contact ID"),
    company_id: z.string().optional().describe("Filter by company ID"),
    min_value: z.number().optional().describe("Minimum value in cents"),
    max_value: z.number().optional().describe("Maximum value in cents"),
    limit: z.number().optional().default(25).describe("Max results"),
  }),
  handler: async (db, args) => {
    const conditions: SQL[] = [isNull(deals.archivedAt)];

    if (args.stage) conditions.push(eq(deals.stage, args.stage));
    if (args.contact_id) conditions.push(eq(deals.contactId, args.contact_id));
    if (args.company_id) conditions.push(eq(deals.companyId, args.company_id));
    if (args.min_value !== undefined) conditions.push(gte(deals.valueCents, args.min_value));
    if (args.max_value !== undefined) conditions.push(lte(deals.valueCents, args.max_value));

    const rows = await db
      .select()
      .from(deals)
      .where(and(...conditions))
      .orderBy(desc(deals.createdAt))
      .limit(args.limit);

    if (rows.length === 0) return kit.text("No deals found.");

    let table = `${rows.length} deal(s):\n\n| Title | Stage | Value | Probability | Close Date |\n|-------|-------|-------|-------------|------------|\n`;
    for (const d of rows) {
      const value = d.valueCents ? `${d.currency} ${(d.valueCents / 100).toFixed(2)}` : "—";
      table += `| ${d.title} | ${d.stage} | ${value} | ${d.probability ?? "—"}% | ${d.expectedClose || "—"} |\n`;
    }
    return kit.text(table);
  },
});
