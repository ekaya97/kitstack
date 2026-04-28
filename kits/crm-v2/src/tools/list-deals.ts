import { z } from "zod";
import { desc, eq, isNull, and } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { deals, contacts } from "../schema";

export const listDeals = defineTool({
  name: "list_deals",
  description: "List deals with optional filters",
  args: z.object({
    stage: z.enum(["lead", "contacted", "proposal", "negotiation", "won", "lost"]).optional().describe("Filter by stage"),
    contactId: z.string().optional().describe("Filter by contact ID"),
    companyId: z.string().optional().describe("Filter by company ID"),
    limit: z.number().optional().default(25).describe("Max results"),
  }),
  handler: async (db, args) => {
    const conditions = [isNull(deals.archivedAt)];
    if (args.stage) conditions.push(eq(deals.stage, args.stage));
    if (args.contactId) conditions.push(eq(deals.contactId, args.contactId));
    if (args.companyId) conditions.push(eq(deals.companyId, args.companyId));

    const result = await db
      .select({
        id: deals.id,
        title: deals.title,
        stage: deals.stage,
        valueCents: deals.valueCents,
        currency: deals.currency,
        probability: deals.probability,
        expectedClose: deals.expectedClose,
        contactName: contacts.firstName,
      })
      .from(deals)
      .leftJoin(contacts, eq(deals.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(desc(deals.createdAt))
      .limit(args.limit);

    if (result.length === 0) {
      return kit.text(args.stage ? `No deals in "${args.stage}".` : "No deals yet.");
    }

    let text = `${result.length} deal(s):\n\n`;
    text += "| Title | Stage | Value | Probability | Contact | Close |\n";
    text += "|-------|-------|-------|------------|---------|-------|\n";
    for (const d of result) {
      const value = d.valueCents ? `${d.currency ?? "€"}${(d.valueCents / 100).toLocaleString()}` : "—";
      text += `| ${d.title} | ${d.stage} | ${value} | ${d.probability ?? "—"}% | ${d.contactName || "—"} | ${d.expectedClose || "—"} |\n`;
    }
    return kit.text(text);
  },
});
