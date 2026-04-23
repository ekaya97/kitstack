import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { actionItems } from "../schema";

export const updateAction = defineTool({
  name: "update_action",
  description: "Update an action item's status (mark as done or reopen)",
  args: z.object({
    actionId: z.string().describe("The action item ID"),
    status: z.enum(["open", "done"]).describe("New status"),
  }),
  handler: async (db, args) => {
    const existing = await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.id, args.actionId))
      .then((rows: any[]) => rows[0]);

    if (!existing) {
      return {
        content: [{ type: "text" as const, text: "Action item not found." }],
        isError: true,
      };
    }

    await db
      .update(actionItems)
      .set({ status: args.status })
      .where(eq(actionItems.id, args.actionId));

    const verb = args.status === "done" ? "completed" : "reopened";
    return {
      content: [
        {
          type: "text" as const,
          text: `Action item "${existing.description}" marked as ${verb}.`,
        },
      ],
    };
  },
});
