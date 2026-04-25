import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { sequences, emails, prospects } from "../schema";

export const deleteSequence = defineTool({
  name: "delete_sequence",
  description: "Permanently delete a sequence and all its emails and prospects",
  args: z.object({
    sequenceId: z.string().describe("Sequence ID to delete"),
  }),
  handler: async (db, args) => {
    const sequence = await db.select().from(sequences).where(eq(sequences.id, args.sequenceId)).then((r: any[]) => r[0]);
    if (!sequence) {
      return { content: [{ type: "text" as const, text: `Sequence not found. Use list_sequences to see valid IDs.` }], isError: true };
    }

    // Cascade delete: prospects → emails → sequence
    await db.delete(prospects).where(eq(prospects.sequenceId, args.sequenceId));
    await db.delete(emails).where(eq(emails.sequenceId, args.sequenceId));
    await db.delete(sequences).where(eq(sequences.id, args.sequenceId));

    return {
      content: [{ type: "text" as const, text: `Sequence "${sequence.name}" and all its emails and prospects have been deleted.` }],
    };
  },
});
