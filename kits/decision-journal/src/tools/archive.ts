import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { decisions, principles } from "../schema";

export const archive = defineTool({
  name: "archive",
  description: "Soft-delete a decision or principle (can be recovered later)",
  args: z.object({
    type: z.enum(["decision", "principle"]).describe("Entity type to archive"),
    id: z.string().describe("Entity ID (dec_xxx or pri_xxx)"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();

    switch (args.type) {
      case "decision": {
        const existing = await db.select({ id: decisions.id }).from(decisions).where(eq(decisions.id, args.id)).limit(1);
        if (existing.length === 0) return kit.error(`Decision "${args.id}" not found.`);
        await db.update(decisions).set({ archivedAt: now, updatedAt: now }).where(eq(decisions.id, args.id));
        break;
      }
      case "principle": {
        const existing = await db.select({ id: principles.id }).from(principles).where(eq(principles.id, args.id)).limit(1);
        if (existing.length === 0) return kit.error(`Principle "${args.id}" not found.`);
        await db.update(principles).set({ archivedAt: now, updatedAt: now }).where(eq(principles.id, args.id));
        break;
      }
    }

    return kit.result(kit.deleted(args.id, args.type, `${args.type} archived.`));
  },
});
