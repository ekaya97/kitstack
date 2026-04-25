import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { deals } from "../schema";
import { getDealsWithContacts } from "../queries/deals";

export const listDeals = defineTool({
  name: "list_deals",
  description: "List deals with optional stage filter",
  args: z.object({
    stage: z.enum(["prospect", "proposal", "negotiation", "won", "lost"]).optional(),
    limit: z.number().optional().default(25),
  }),
  handler: async (db, args, ctx) => {
    let result = await getDealsWithContacts(db);

    if (args.stage) {
      result = result.filter((d) => d.stage === args.stage);
    }
    result = result.slice(0, args.limit);

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
