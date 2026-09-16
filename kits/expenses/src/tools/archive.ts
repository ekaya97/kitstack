import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { withToolMetadata } from "../tool-metadata";
import { expenses } from "../schema";

export const archive = withToolMetadata(defineTool({
  name: "archive",
  description: "Soft-delete an expense (can be recovered later)",
  args: z.object({
    id: z.string().describe("Expense ID (exp_xxx)"),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db.select().from(expenses).where(eq(expenses.id, args.id)).limit(1);
    if (existing.length === 0) return kit.notFound("expense", args.id);

    const now = new Date().toISOString();
    await ctx.db.update(expenses).set({ archivedAt: now, updatedAt: now }).where(eq(expenses.id, args.id));

    return kit.result(kit.deleted(args.id, "expense", `Expense ${args.id} archived.`));
  },
}), "act", "destructive");
