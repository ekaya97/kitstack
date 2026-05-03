import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { sequences, emails, prospects } from "../schema";

export const exportSequence = defineTool({
  name: "export_sequence",
  description: "Export a sequence as formatted text including all emails and prospects",
  args: z.object({
    sequenceId: z.string().describe("Sequence ID"),
  }),
  handler: async (db, args) => {
    const sequence = await db.select().from(sequences).where(eq(sequences.id, args.sequenceId)).then((r: any[]) => r[0]);
    if (!sequence) {
      return { content: [{ type: "text" as const, text: "Sequence not found." }], isError: true };
    }

    let text = `# ${sequence.name}\n`;
    text += `**Status:** ${sequence.status}\n`;
    if (sequence.targetPersona) text += `**Target Persona:** ${sequence.targetPersona}\n`;
    if (sequence.tone) text += `**Tone:** ${sequence.tone}\n`;

    const allEmails = await db.select().from(emails).where(eq(emails.sequenceId, args.sequenceId)).orderBy(asc(emails.position));
    if (allEmails.length > 0) {
      text += `\n## Emails (${allEmails.length})\n`;
      for (const e of allEmails) {
        text += `\n### Email #${e.position}${e.delayDays > 0 ? ` (delay: ${e.delayDays} days)` : ""}\n`;
        text += `**Subject:** ${e.subject}\n\n${e.body}\n`;
      }
    } else {
      text += `\n*No emails in this sequence yet.*\n`;
    }

    const allProspects = await db.select().from(prospects).where(eq(prospects.sequenceId, args.sequenceId));
    if (allProspects.length > 0) {
      text += `\n## Prospects (${allProspects.length})\n\n| Name | Company | Email | Status |\n|------|---------|-------|--------|\n`;
      for (const p of allProspects) {
        text += `| ${p.name} | ${p.company || "—"} | ${p.email || "—"} | ${p.status} |\n`;
      }
    }

    return { content: [{ type: "text" as const, text }] };
  },
});
