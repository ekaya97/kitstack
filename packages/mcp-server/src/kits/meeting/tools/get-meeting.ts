import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { meetings, actionItems, decisions } from "../schema";

export const getMeeting = defineTool({
  name: "get_meeting",
  description: "Get a meeting's details including action items and decisions",
  args: z.object({
    meetingId: z.string().describe("The meeting ID"),
  }),
  handler: async (db, args) => {
    const meeting = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, args.meetingId))
      .then((rows: any[]) => rows[0]);

    if (!meeting) {
      return {
        content: [{ type: "text" as const, text: "Meeting not found." }],
        isError: true,
      };
    }

    const actions = await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.meetingId, args.meetingId));

    const decs = await db
      .select()
      .from(decisions)
      .where(eq(decisions.meetingId, args.meetingId));

    let text = `# ${meeting.title}\n**Date:** ${meeting.date}\n**Attendees:** ${(meeting.attendees as string[]).join(", ")}\n`;

    if (decs.length > 0) {
      text += `\n## Decisions\n${decs.map((d: any) => `- ${d.description}`).join("\n")}\n`;
    }

    if (actions.length > 0) {
      text += `\n## Action Items\n| # | Action | Owner | Deadline | Status |\n|---|--------|-------|----------|--------|\n`;
      actions.forEach((a: any, i: number) => {
        text += `| ${i + 1} | ${a.description} | ${a.owner || "—"} | ${a.deadline || "—"} | ${a.status} |\n`;
      });
    }

    return { content: [{ type: "text" as const, text }] };
  },
});
