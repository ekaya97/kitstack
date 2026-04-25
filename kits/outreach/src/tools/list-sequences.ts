import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { sequences, emails, prospects } from "../schema";

const listSequencesArgs = z.object({
  status: z.enum(["draft", "active", "paused", "archived"]).optional().describe("Filter by status. If omitted, returns all sequences."),
  limit: z.number().optional().default(25).describe("Max sequences to return (default 25)"),
});

async function loadSequences(db: LibSQLDatabase, args: z.infer<typeof listSequencesArgs>, ctx: KitContext) {
  const query = args.status
    ? db.select().from(sequences).where(eq(sequences.status, args.status)).orderBy(desc(sequences.createdAt)).limit(args.limit)
    : db.select().from(sequences).orderBy(desc(sequences.createdAt)).limit(args.limit);

  const result = await query;

  const withCounts = await Promise.all(
    result.map(async (seq) => {
      const seqEmails = await db.select().from(emails).where(eq(emails.sequenceId, seq.id));
      const seqProspects = await db.select().from(prospects).where(eq(prospects.sequenceId, seq.id));
      return { ...seq, emailCount: seqEmails.length, prospectCount: seqProspects.length };
    })
  );

  return withCounts;
}

export const listSequences = defineTool({
  name: "list_sequences",
  description: "List all outreach sequences. Returns all non-archived sequences by default.",
  args: listSequencesArgs,
  load: loadSequences,

  handler: async (db, args, ctx) => {
    const result = await loadSequences(db, args, ctx);

    if (result.length === 0) return kit.text("No sequences found.");

    let text = `${result.length} sequence(s):\n\n| ID | Name | Status | Emails | Prospects |\n|----|------|--------|--------|-----------|\n`;
    for (const seq of result) {
      text += `| \`${seq.id}\` | ${seq.name} | ${seq.status} | ${seq.emailCount} | ${seq.prospectCount} |\n`;
    }

    return kit.text(text);
  },
});
