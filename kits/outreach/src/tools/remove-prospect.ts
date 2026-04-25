import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { prospects } from "../schema";

export const removeProspect = defineTool({
  name: "remove_prospect",
  description: "Remove a prospect from a sequence",
  args: z.object({
    prospectId: z.string().describe("Prospect ID to remove (use export_sequence to find prospect IDs)"),
  }),
  handler: async (db, args, ctx) => {
    const existing = await db.select().from(prospects).where(eq(prospects.id, args.prospectId)).then((r) => r[0] ?? null);
    if (!existing) return kit.notFound("Prospect", args.prospectId);

    await db.delete(prospects).where(eq(prospects.id, args.prospectId));

    return kit.text(`Prospect "${existing.name}" removed.`);
  },
});
