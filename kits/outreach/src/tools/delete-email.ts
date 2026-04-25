import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { emails } from "../schema";

export const deleteEmail = defineTool({
  name: "delete_email",
  description: "Delete an email from a sequence",
  args: z.object({
    emailId: z.string().describe("Email ID to delete (use export_sequence to find email IDs)"),
  }),
  handler: async (db, args, ctx) => {
    const existing = await db.select().from(emails).where(eq(emails.id, args.emailId)).then((r) => r[0] ?? null);
    if (!existing) return kit.notFound("Email", args.emailId);

    await db.delete(emails).where(eq(emails.id, args.emailId));

    return kit.text(`Email #${existing.position} ("${existing.subject}") deleted.`);
  },
});
