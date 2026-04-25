import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { actionItems, meetings } from "../schema";

const listActionsArgs = z.object({
  status: z.enum(["open", "done"]).optional().describe("Filter by status"),
  owner: z.string().optional().describe("Filter by owner name"),
});

async function loadActions(db: LibSQLDatabase, args: z.infer<typeof listActionsArgs>, ctx: KitContext) {
  const conditions = [];
  if (args.status) conditions.push(eq(actionItems.status, args.status));
  if (args.owner) conditions.push(eq(actionItems.owner, args.owner));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      id: actionItems.id,
      description: actionItems.description,
      owner: actionItems.owner,
      deadline: actionItems.deadline,
      status: actionItems.status,
      meetingId: actionItems.meetingId,
      meetingTitle: meetings.title,
      meetingDate: meetings.date,
    })
    .from(actionItems)
    .leftJoin(meetings, eq(actionItems.meetingId, meetings.id))
    .where(whereClause)
    .orderBy(asc(actionItems.deadline));
}

export const listActions = defineTool({
  name: "list_actions",
  description: "List action items across all meetings with optional status and owner filters",
  args: listActionsArgs,
  load: loadActions,

  handler: async (db, args, ctx) => {
    const results = await loadActions(db, args, ctx);
    if (results.length === 0) {
      return kit.text("No action items found.");
    }

    const today = new Date().toISOString().split("T")[0];
    let text = `${results.length} action item(s):\n\n`;
    text += `| # | Action | Owner | Deadline | Status | Meeting |\n`;
    text += `|---|--------|-------|----------|--------|--------|\n`;

    results.forEach((a, i) => {
      const overdue = a.status === "open" && a.deadline && a.deadline < today;
      const deadlineDisplay = a.deadline
        ? overdue ? `**${a.deadline}** (overdue)` : a.deadline
        : "—";
      text += `| ${i + 1} | ${a.description} | ${a.owner || "—"} | ${deadlineDisplay} | ${a.status} | ${a.meetingTitle || "—"} |\n`;
    });

    return kit.text(text);
  },
});
