import { z } from "zod";
import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { meetings, actionItems, decisions } from "../schema";

const getMeetingArgs = z.object({
  meetingId: z.string().describe("The meeting ID"),
});

async function loadMeeting(db: LibSQLDatabase, args: z.infer<typeof getMeetingArgs>, ctx: KitContext) {
  const meeting = await db.select().from(meetings).where(eq(meetings.id, args.meetingId)).then((r) => r[0] ?? null);
  if (!meeting) return null;

  const actions = await db.select().from(actionItems).where(eq(actionItems.meetingId, args.meetingId));
  const decs = await db.select().from(decisions).where(eq(decisions.meetingId, args.meetingId));

  return { meeting, actions, decisions: decs };
}

export const getMeeting = defineTool({
  name: "get_meeting",
  description: "Get a meeting's details including action items and decisions",
  args: getMeetingArgs,
  load: loadMeeting,

  handler: async (db, args, ctx) => {
    const data = await loadMeeting(db, args, ctx);
    if (!data) {
      return kit.notFound("meeting", args.meetingId);
    }

    const { meeting, actions, decisions: decs } = data;

    let text = `# ${meeting.title}\n**Date:** ${meeting.date}\n**Attendees:** ${(meeting.attendees as string[]).join(", ")}\n`;

    if (decs.length > 0) {
      text += `\n## Decisions\n${decs.map((d) => `- ${d.description}`).join("\n")}\n`;
    }

    if (actions.length > 0) {
      text += `\n## Action Items\n| # | Action | Owner | Deadline | Status |\n|---|--------|-------|----------|--------|\n`;
      actions.forEach((a, i) => {
        text += `| ${i + 1} | ${a.description} | ${a.owner || "—"} | ${a.deadline || "—"} | ${a.status} |\n`;
      });
    }

    return kit.text(text);
  },
});
