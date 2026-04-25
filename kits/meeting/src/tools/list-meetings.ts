import { z } from "zod";
import { desc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { meetings } from "../schema";

const listMeetingsArgs = z.object({
  limit: z.number().optional().default(20).describe("Max results to return (default 20)"),
});

async function loadMeetings(db: LibSQLDatabase, args: z.infer<typeof listMeetingsArgs>, ctx: KitContext) {
  return db
    .select({
      id: meetings.id,
      title: meetings.title,
      date: meetings.date,
      attendees: meetings.attendees,
    })
    .from(meetings)
    .orderBy(desc(meetings.date))
    .limit(args.limit);
}

export const listMeetings = defineTool({
  name: "list_meetings",
  description: "List all meetings, most recent first",
  args: listMeetingsArgs,
  load: loadMeetings,

  handler: async (db, args, ctx) => {
    const result = await loadMeetings(db, args, ctx);
    if (result.length === 0) {
      return kit.text("No meetings found.");
    }

    let text = `${result.length} meeting(s):\n\n`;
    text += `| ID | Title | Date | Attendees |\n|----|-------|------|-----------|\n`;
    for (const m of result) {
      text += `| \`${m.id}\` | ${m.title} | ${m.date} | ${(m.attendees as string[]).join(", ")} |\n`;
    }
    return kit.text(text);
  },
});
