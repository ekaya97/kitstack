import { z } from "zod";
import { desc } from "drizzle-orm";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { meetings } from "../schema";

export const listMeetings = defineTool({
  name: "list_meetings",
  description: "List all meetings, most recent first",
  args: z.object({
    limit: z.number().optional().default(20).describe("Max results to return"),
  }),
  handler: async (db, args) => {
    const result = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        date: meetings.date,
        attendees: meetings.attendees,
      })
      .from(meetings)
      .orderBy(desc(meetings.date))
      .limit(args.limit);

    if (result.length === 0) {
      return { content: [{ type: "text" as const, text: "No meetings found." }] };
    }

    const lines = result.map(
      (m) => `- **${m.title}** (${m.date}) — ${(m.attendees as string[]).join(", ")}`
    );

    return {
      content: [
        { type: "text" as const, text: `Found ${result.length} meeting(s):\n\n${lines.join("\n")}` },
      ],
    };
  },
});
