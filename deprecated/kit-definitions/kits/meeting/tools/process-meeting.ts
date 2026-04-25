import { nanoid } from "nanoid";
import { z } from "zod";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { meetings, actionItems, decisions } from "../schema";

export const processMeetingArgs = z.object({
  title: z.string().describe("Meeting title"),
  date: z.string().describe("Meeting date (YYYY-MM-DD)"),
  attendees: z.array(z.string()).describe("List of attendee names"),
  notes: z.string().describe("Raw meeting notes or transcript"),
  extractedActions: z
    .array(
      z.object({
        description: z.string(),
        owner: z.string().optional(),
        deadline: z.string().optional(),
      })
    )
    .describe("Action items extracted from the notes"),
  extractedDecisions: z
    .array(z.string())
    .describe("Decisions made during the meeting"),
});

export const processMeeting = defineTool({
  name: "process_meeting",
  description: "Store a meeting with its extracted action items and decisions",
  args: processMeetingArgs,
  handler: async (db, args) => {
    const meetingId = nanoid();

    await db.insert(meetings).values({
      id: meetingId,
      title: args.title,
      date: args.date,
      attendees: args.attendees,
      rawNotes: args.notes,
    });

    const actionIds: string[] = [];
    for (const action of args.extractedActions) {
      const id = nanoid();
      actionIds.push(id);
      await db.insert(actionItems).values({
        id,
        meetingId,
        description: action.description,
        owner: action.owner ?? null,
        deadline: action.deadline ?? null,
      });
    }

    for (const decision of args.extractedDecisions) {
      await db.insert(decisions).values({
        id: nanoid(),
        meetingId,
        description: decision,
      });
    }

    const noOwner = args.extractedActions.filter((a) => !a.owner).length;
    const noDeadline = args.extractedActions.filter((a) => !a.deadline).length;

    let summary = `Meeting "${args.title}" saved with ${args.extractedActions.length} action item(s) and ${args.extractedDecisions.length} decision(s).`;
    if (noOwner > 0) summary += ` ⚠️ ${noOwner} action(s) have no owner.`;
    if (noDeadline > 0) summary += ` ⚠️ ${noDeadline} action(s) have no deadline.`;

    return { content: [{ type: "text" as const, text: summary }] };
  },
});
