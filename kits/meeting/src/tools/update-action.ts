import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { actionItems } from "../schema";

export const updateAction = defineTool({
  name: "update_action",
  description: "Update an action item's status (mark as done or reopen)",
  args: z.object({
    actionId: z.string().describe("The action item ID"),
    status: z.enum(["open", "done"]).describe("New status"),
  }),
  handler: async (db, args, ctx) => {
    const existing = await db.select().from(actionItems).where(eq(actionItems.id, args.actionId)).then((r) => r[0]);
    if (!existing) {
      return kit.notFound("action item", args.actionId);
    }

    await db.update(actionItems).set({ status: args.status }).where(eq(actionItems.id, args.actionId));

    const verb = args.status === "done" ? "completed" : "reopened";
    return kit.text(`Action item "${existing.description}" marked as ${verb}.`);
  },
});
