import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { deals, contacts } from "../schema";

export const listDeals = defineTool({
  name: "list_deals",
  description: "List deals with optional stage filter",
  args: z.object({
    stage: z.enum(["prospect", "proposal", "negotiation", "won", "lost"]).optional(),
    limit: z.number().optional().default(25),
  }),
  handler: async (db, args) => {
    const query = db
      .select({
        id: deals.id,
        name: deals.name,
        value: deals.value,
        currency: deals.currency,
        stage: deals.stage,
        expectedCloseDate: deals.expectedCloseDate,
        contactName: contacts.name,
      })
      .from(deals)
      .leftJoin(contacts, eq(deals.contactId, contacts.id))
      .orderBy(desc(deals.createdAt))
      .limit(args.limit);

    const result = args.stage
      ? await query.where(eq(deals.stage, args.stage))
      : await query;

    if (result.length === 0) {
      return { content: [{ type: "text" as const, text: args.stage ? `No deals in "${args.stage}".` : "No deals yet." }] };
    }

    let text = `${result.length} deal(s):\n\n| Deal | Contact | Value | Stage | Close Date |\n|------|---------|-------|-------|------------|\n`;
    for (const d of result) {
      const val = d.value ? `€${d.value.toLocaleString()}` : "—";
      text += `| ${d.name} | ${d.contactName || "—"} | ${val} | ${d.stage} | ${d.expectedCloseDate || "—"} |\n`;
    }
    return { content: [{ type: "text" as const, text }] };
  },
});
