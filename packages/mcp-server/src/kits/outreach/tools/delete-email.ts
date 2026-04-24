import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { emails } from "../schema";

export const deleteEmail = defineTool({
  name: "delete_email",
  description: "Delete an email from a sequence",
  args: z.object({
    emailId: z.string().describe("Email ID to delete (use export_sequence to find email IDs)"),
  }),
  handler: async (db, args) => {
    const existing = await db.select().from(emails).where(eq(emails.id, args.emailId)).then((r: any[]) => r[0]);
    if (!existing) {
      return { content: [{ type: "text" as const, text: `Email not found. Use export_sequence to see email IDs.` }], isError: true };
    }

    await db.delete(emails).where(eq(emails.id, args.emailId));

    return {
      content: [{ type: "text" as const, text: `Email #${existing.position} ("${existing.subject}") deleted.` }],
    };
  },
});
