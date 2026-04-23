import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { actionItems, meetings } from "../schema";

export const listActions = defineTool({
  name: "list_actions",
  description: "List action items across all meetings, with optional filters",
  args: z.object({
    status: z
      .enum(["open", "done"])
      .optional()
      .describe("Filter by status"),
    owner: z.string().optional().describe("Filter by owner name"),
  }),
  handler: async (db, args) => {
    const conditions = [];
    if (args.status) conditions.push(eq(actionItems.status, args.status));
    if (args.owner) conditions.push(eq(actionItems.owner, args.owner));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
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

    if (results.length === 0) {
      return { content: [{ type: "text" as const, text: "No action items found." }] };
    }

    const today = new Date().toISOString().split("T")[0];
    let text = `Found ${results.length} action item(s):\n\n`;
    text += `| # | Action | Owner | Deadline | Status | Meeting |\n`;
    text += `|---|--------|-------|----------|--------|--------|\n`;

    results.forEach((a, i) => {
      const overdue = a.status === "open" && a.deadline && a.deadline < today;
      const deadlineDisplay = a.deadline
        ? overdue
          ? `⚠️ ${a.deadline}`
          : a.deadline
        : "—";
      text += `| ${i + 1} | ${a.description} | ${a.owner || "—"} | ${deadlineDisplay} | ${a.status} | ${a.meetingTitle || "—"} |\n`;
    });

    return { content: [{ type: "text" as const, text }] };
  },
});
