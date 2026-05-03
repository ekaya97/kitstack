import { nanoid } from "nanoid";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { sequences, emails } from "../schema";

export const generateEmails = defineTool({
  name: "generate_emails",
  description: "Add generated emails to a sequence",
  args: z.object({
    sequenceId: z.string().describe("Sequence ID"),
    emails: z.array(z.object({
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body (plain text or markdown)"),
      delayDays: z.number().optional().default(0).describe("Days to wait before sending this email (0 for first email)"),
    })).describe("Array of emails to add, in order"),
  }),
  handler: async (db, args) => {
    const sequence = await db.select().from(sequences).where(eq(sequences.id, args.sequenceId)).then((r: any[]) => r[0]);
    if (!sequence) {
      return { content: [{ type: "text" as const, text: "Sequence not found." }], isError: true };
    }

    // Get current max position
    const existing = await db.select().from(emails).where(eq(emails.sequenceId, args.sequenceId));
    let position = existing.length;

    for (const email of args.emails) {
      position += 1;
      await db.insert(emails).values({
        id: nanoid(),
        sequenceId: args.sequenceId,
        position,
        subject: email.subject,
        body: email.body,
        delayDays: email.delayDays ?? 0,
      });
    }

    return {
      content: [{ type: "text" as const, text: `Added ${args.emails.length} email(s) to sequence "${sequence.name}" (positions ${existing.length + 1}–${position}).` }],
    };
  },
});
