import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { deals, contacts } from "../schema";

const listDealsArgs = z.object({
  stage: z.enum(["prospect", "proposal", "negotiation", "won", "lost"]).optional(),
  limit: z.number().optional().default(25),
});

async function loadDeals(db: LibSQLDatabase, args: z.infer<typeof listDealsArgs>, ctx: KitContext) {
  const rows = await db
    .select({
      id: deals.id,
      name: deals.name,
      contactId: deals.contactId,
      value: deals.value,
      currency: deals.currency,
      stage: deals.stage,
      notes: deals.notes,
      expectedCloseDate: deals.expectedCloseDate,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      contactName: contacts.name,
    })
    .from(deals)
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .orderBy(desc(deals.createdAt))
    .limit(args.limit);

  return args.stage ? rows.filter((d) => d.stage === args.stage) : rows;
}

export const listDeals = defineTool({
  name: "list_deals",
  description: "List deals with optional stage filter",
  args: listDealsArgs,
  load: loadDeals,

  handler: async (db, args, ctx) => {
    const result = await loadDeals(db, args, ctx);
    if (result.length === 0) {
      return kit.text(args.stage ? `No deals in "${args.stage}".` : "No deals yet.");
    }

    let text = `${result.length} deal(s):\n\n| ID | Deal | Contact | Value | Stage | Close Date |\n|----|------|---------|-------|-------|------------|\n`;
    for (const d of result) {
      const val = d.value ? `€${d.value.toLocaleString()}` : "—";
      text += `| \`${d.id}\` | ${d.name} | ${d.contactName || "—"} | ${val} | ${d.stage} | ${d.expectedCloseDate || "—"} |\n`;
    }
    return kit.text(text);
  },
});
