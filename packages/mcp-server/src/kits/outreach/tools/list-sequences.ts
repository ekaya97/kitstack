import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { sequences, emails, prospects } from "../schema";

export const listSequences = defineTool({
  name: "list_sequences",
  description: "List all outreach sequences",
  args: z.object({
    status: z.enum(["draft", "active", "paused", "archived"]).optional().describe("Filter by status"),
    limit: z.number().optional().default(25).describe("Max results"),
  }),
  handler: async (db, args) => {
    let query = db.select().from(sequences).orderBy(desc(sequences.createdAt)).limit(args.limit);

    if (args.status) {
      query = db.select().from(sequences).where(eq(sequences.status, args.status)).orderBy(desc(sequences.createdAt)).limit(args.limit);
    }

    const result = await query;

    if (result.length === 0) {
      return { content: [{ type: "text" as const, text: "No sequences found." }] };
    }

    let text = `${result.length} sequence(s):\n\n| Name | Target Persona | Tone | Status | Emails | Prospects |\n|------|---------------|------|--------|--------|-----------|\n`;

    for (const seq of result) {
      const emailCount = await db.select().from(emails).where(eq(emails.sequenceId, seq.id));
      const prospectCount = await db.select().from(prospects).where(eq(prospects.sequenceId, seq.id));
      text += `| ${seq.name} | ${seq.targetPersona || "—"} | ${seq.tone || "—"} | ${seq.status} | ${emailCount.length} | ${prospectCount.length} |\n`;
    }

    return { content: [{ type: "text" as const, text }] };
  },
});
