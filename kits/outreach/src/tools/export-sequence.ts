import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { sequences, emails, prospects } from "../schema";

const exportSequenceArgs = z.object({
  sequenceId: z.string().describe("Sequence ID"),
});

async function loadSequenceExport(db: LibSQLDatabase, args: z.infer<typeof exportSequenceArgs>, ctx: KitContext) {
  const sequence = await db.select().from(sequences).where(eq(sequences.id, args.sequenceId)).then((r) => r[0] ?? null);
  if (!sequence) return null;

  const allEmails = await db.select().from(emails).where(eq(emails.sequenceId, args.sequenceId)).orderBy(asc(emails.position));
  const allProspects = await db.select().from(prospects).where(eq(prospects.sequenceId, args.sequenceId));

  return { sequence, emails: allEmails, prospects: allProspects };
}

export const exportSequence = defineTool({
  name: "export_sequence",
  description: "Export a sequence as formatted text including all emails, prospects, and personalization hooks",
  args: exportSequenceArgs,
  load: loadSequenceExport,

  handler: async (db, args, ctx) => {
    const result = await loadSequenceExport(db, args, ctx);
    if (!result) return kit.notFound("Sequence", args.sequenceId);

    const { sequence, emails: seqEmails, prospects: seqProspects } = result;

    let text = `# ${sequence.name}\n`;
    text += `**ID:** \`${sequence.id}\`\n`;
    text += `**Status:** ${sequence.status}\n`;
    if (sequence.targetPersona) text += `**Target Persona:** ${sequence.targetPersona}\n`;
    if (sequence.tone) text += `**Tone:** ${sequence.tone}\n`;

    if (seqEmails.length > 0) {
      text += `\n## Emails (${seqEmails.length})\n`;
      for (const e of seqEmails) {
        text += `\n### Email #${e.position} (ID: \`${e.id}\`)${e.delayDays > 0 ? ` — delay: ${e.delayDays} days` : ""}\n`;
        text += `**Subject:** ${e.subject}\n\n${e.body}\n`;
      }
    } else {
      text += `\n*No emails in this sequence yet.*\n`;
    }

    if (seqProspects.length > 0) {
      text += `\n## Prospects (${seqProspects.length})\n\n| ID | Name | Company | Email | Status |\n|----|------|---------|-------|--------|\n`;
      for (const p of seqProspects) {
        text += `| \`${p.id}\` | ${p.name} | ${p.company || "—"} | ${p.email || "—"} | ${p.status} |\n`;
      }

      const withHooks = seqProspects.filter((p) => p.personalizationHooks);
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

    return kit.text(text);
  },
});
