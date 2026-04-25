import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { actionItems, meetings } from "../schema";

const openItemsArgs = z.object({});

async function loadOpenItems(db: LibSQLDatabase, args: z.infer<typeof openItemsArgs>, ctx: KitContext) {
  return db
    .select({
      id: actionItems.id,
      description: actionItems.description,
      owner: actionItems.owner,
      deadline: actionItems.deadline,
      meetingId: actionItems.meetingId,
      meetingTitle: meetings.title,
      meetingDate: meetings.date,
    })
    .from(actionItems)
    .leftJoin(meetings, eq(actionItems.meetingId, meetings.id))
    .where(eq(actionItems.status, "open"))
    .orderBy(asc(actionItems.deadline));
}

export const openItemsSummary = defineTool({
  name: "open_items_summary",
  description: "Get a summary of all open action items grouped by meeting",
  args: openItemsArgs,
  load: loadOpenItems,

  handler: async (db, args, ctx) => {
    const results = await loadOpenItems(db, args, ctx);
    if (results.length === 0) {
      return kit.text("No open action items. You're all caught up!");
    }

    const today = new Date().toISOString().split("T")[0];
    const overdue = results.filter((a) => a.deadline && a.deadline < today);

    // Group by meeting
    const byMeeting = new Map<string, typeof results>();
    for (const item of results) {
      const key = item.meetingId;
      if (!byMeeting.has(key)) byMeeting.set(key, []);
      byMeeting.get(key)!.push(item);
    }

    let text = `**${results.length} open action item(s)**`;
    if (overdue.length > 0) {
      text += ` — **${overdue.length} overdue**`;
    }
    text += "\n\n";

    for (const [, items] of byMeeting) {
      const first = items[0];
      text += `### ${first.meetingTitle || "Unknown meeting"} (${first.meetingDate || "—"})\n`;
      for (const item of items) {
        const deadlineStr = item.deadline
          ? item.deadline < today ? `${item.deadline} (overdue)` : item.deadline
          : "no deadline";
        text += `- [ ] ${item.description} — ${item.owner || "unassigned"} (${deadlineStr})\n`;
      }
      text += "\n";
    }

    return kit.text(text);
  },
});
