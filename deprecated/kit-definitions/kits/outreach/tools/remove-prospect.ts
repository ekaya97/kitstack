import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { prospects } from "../schema";

export const removeProspect = defineTool({
  name: "remove_prospect",
  description: "Remove a prospect from a sequence",
  args: z.object({
    prospectId: z.string().describe("Prospect ID to remove (use export_sequence to find prospect IDs)"),
  }),
  handler: async (db, args) => {
    const existing = await db.select().from(prospects).where(eq(prospects.id, args.prospectId)).then((r: any[]) => r[0]);
    if (!existing) {
      return { content: [{ type: "text" as const, text: `Prospect not found. Use export_sequence to see prospect IDs.` }], isError: true };
    }

    await db.delete(prospects).where(eq(prospects.id, args.prospectId));

    return {
      content: [{ type: "text" as const, text: `Prospect "${existing.name}" removed.` }],
    };
  },
});
