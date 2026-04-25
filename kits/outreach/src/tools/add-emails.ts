import { nanoid } from "nanoid";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { sequences, emails } from "../schema";

export const addEmails = defineTool({
  name: "add_emails",
  description: "Add emails to a sequence. Provide the full email content — subject and body — for each email.",
  args: z.object({
    sequenceId: z.string().describe("Sequence ID"),
    emails: z.array(z.object({
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body (plain text or markdown)"),
      delayDays: z.number().optional().default(0).describe("Days after the previous email. 0 = send on enrollment (only valid for email #1)."),
    })).describe("Array of emails to add, in sending order"),
  }),
  handler: async (db, args, ctx) => {
    const sequence = await db.select().from(sequences).where(eq(sequences.id, args.sequenceId)).then((r) => r[0] ?? null);
    if (!sequence) return kit.notFound("Sequence", args.sequenceId);

    const existing = await db.select().from(emails).where(eq(emails.sequenceId, args.sequenceId));
    let position = existing.length;

    const created: { id: string; position: number; subject: string }[] = [];

    for (const email of args.emails) {
      position += 1;
      const id = nanoid();
      await db.insert(emails).values({
        id,
        sequenceId: args.sequenceId,
        position,
        subject: email.subject,
        body: email.body,
        delayDays: email.delayDays ?? 0,
      });
      created.push({ id, position, subject: email.subject });
    }

    const idList = created.map((e) => `- \`${e.id}\` (pos ${e.position}): ${e.subject}`).join("\n");
    let text = `Added ${args.emails.length} email(s) to sequence "${sequence.name}":\n\n${idList}`;
    text += `\n\n**Next:** \`add_prospect\` to add recipients, or \`edit_email\` with an email ID above to revise.`;

    return kit.text(text);
  },
});
