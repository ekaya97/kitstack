import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { sequences, emails, prospects } from "../schema";

export const exportSequence = defineTool({
  name: "export_sequence",
  description: "Export a sequence as formatted text including all emails, prospects, and personalization hooks",
  args: z.object({
    sequenceId: z.string().describe("Sequence ID"),
  }),
  handler: async (db, args) => {
    const sequence = await db.select().from(sequences).where(eq(sequences.id, args.sequenceId)).then((r: any[]) => r[0]);
    if (!sequence) {
      return { content: [{ type: "text" as const, text: `Sequence not found. Use list_sequences to see valid IDs.` }], isError: true };
    }

    let text = `# ${sequence.name}\n`;
    text += `**ID:** \`${sequence.id}\`\n`;
    text += `**Status:** ${sequence.status}\n`;
    if (sequence.targetPersona) text += `**Target Persona:** ${sequence.targetPersona}\n`;
    if (sequence.tone) text += `**Tone:** ${sequence.tone}\n`;

    const allEmails = await db.select().from(emails).where(eq(emails.sequenceId, args.sequenceId)).orderBy(asc(emails.position));
    if (allEmails.length > 0) {
      text += `\n## Emails (${allEmails.length})\n`;
      for (const e of allEmails) {
        text += `\n### Email #${e.position} (ID: \`${e.id}\`)${e.delayDays > 0 ? ` — delay: ${e.delayDays} days` : ""}\n`;
        text += `**Subject:** ${e.subject}\n\n${e.body}\n`;
      }
    } else {
      text += `\n*No emails in this sequence yet.*\n`;
    }

    const allProspects = await db.select().from(prospects).where(eq(prospects.sequenceId, args.sequenceId));
    if (allProspects.length > 0) {
      text += `\n## Prospects (${allProspects.length})\n\n| ID | Name | Company | Email | Status |\n|----|------|---------|-------|--------|\n`;
      for (const p of allProspects) {
        text += `| \`${p.id}\` | ${p.name} | ${p.company || "—"} | ${p.email || "—"} | ${p.status} |\n`;
      }

      // Include personalization hooks for prospects that have them
      const withHooks = allProspects.filter((p) => p.personalizationHooks);
      if (withHooks.length > 0) {
        text += `\n### Personalization Hooks\n`;
        for (const p of withHooks) {
          try {
            const hooks = JSON.parse(p.personalizationHooks!);
            const entries = Object.entries(hooks).map(([k, v]) => `  - **${k}:** ${v}`).join("\n");
            text += `\n**${p.name}** (\`${p.id}\`):\n${entries}\n`;
          } catch {
            // skip malformed hooks
          }
        }
      }
    }

    return { content: [{ type: "text" as const, text }] };
  },
});
