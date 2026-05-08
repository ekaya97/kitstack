import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { expenses } from "../schema";

export const archive = defineTool({
  name: "archive",
  description: "Soft-delete an expense (can be recovered later)",
  args: z.object({
    id: z.string().describe("Expense ID (exp_xxx)"),
  }),
  handler: async (db, args) => {
    const existing = await db.select().from(expenses).where(eq(expenses.id, args.id)).limit(1);
    if (existing.length === 0) return kit.notFound("expense", args.id);

    const now = new Date().toISOString();
    await db.update(expenses).set({ archivedAt: now, updatedAt: now }).where(eq(expenses.id, args.id));

    return kit.result(kit.deleted(args.id, "expense", `Expense ${args.id} archived.`));
  },
});
