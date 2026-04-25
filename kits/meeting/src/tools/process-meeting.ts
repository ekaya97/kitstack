import { nanoid } from "nanoid";
import { z } from "zod";
import { defineTool, kit } from "../sdk";
import { meetings, actionItems, decisions } from "../schema";

export const processMeeting = defineTool({
  name: "process_meeting",
  description: "Store a meeting with its extracted action items and decisions",
  args: z.object({
    title: z.string().describe("Meeting title"),
    date: z.string().describe("Meeting date (YYYY-MM-DD)"),
    attendees: z.array(z.string()).describe("List of attendee names"),
    notes: z.string().describe("Raw meeting notes or transcript"),
    extractedActions: z
      .array(
        z.object({
          description: z.string().describe("Action item description"),
          owner: z.string().optional().describe("Person responsible"),
          deadline: z.string().optional().describe("Due date (YYYY-MM-DD)"),
        })
      )
      .describe("Action items extracted from the notes"),
    extractedDecisions: z
      .array(z.string())
      .describe("Decisions made during the meeting"),
  }),
  handler: async (db, args, ctx) => {
    const meetingId = nanoid();

    await db.insert(meetings).values({
      id: meetingId,
      title: args.title,
      date: args.date,
      attendees: args.attendees,
      rawNotes: args.notes,
    });

    for (const action of args.extractedActions) {
      await db.insert(actionItems).values({
        id: nanoid(),
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

    let text = `Meeting "${args.title}" saved (ID: \`${meetingId}\`) with ${args.extractedActions.length} action item(s) and ${args.extractedDecisions.length} decision(s).`;
    if (noOwner > 0) text += ` Warning: ${noOwner} action(s) have no owner.`;
    if (noDeadline > 0) text += ` Warning: ${noDeadline} action(s) have no deadline.`;

    return kit.text(text);
  },
});
