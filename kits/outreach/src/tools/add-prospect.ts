import { nanoid } from "nanoid";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { sequences, prospects } from "../schema";

export const addProspect = defineTool({
  name: "add_prospect",
  description: "Add a prospect to an outreach sequence",
  args: z.object({
    sequenceId: z.string().describe("Sequence ID"),
    name: z.string().describe("Prospect's full name"),
    company: z.string().optional().describe("Company name"),
    email: z.string().optional().describe("Email address"),
    linkedinUrl: z.string().optional().describe("LinkedIn profile URL (include full https:// URL)"),
    status: z.enum(["pending", "contacted", "replied", "bounced", "opted_out"]).optional().default("pending"),
  }),
  handler: async (db, args, ctx) => {
    const sequence = await db.select().from(sequences).where(eq(sequences.id, args.sequenceId)).then((r) => r[0] ?? null);
    if (!sequence) return kit.notFound("Sequence", args.sequenceId);

    const id = nanoid();
    await db.insert(prospects).values({
      id,
      sequenceId: args.sequenceId,
      name: args.name,
      company: args.company ?? null,
      email: args.email ?? null,
      linkedinUrl: args.linkedinUrl ?? null,
      status: args.status,
    });

    let text = `Prospect "${args.name}" added to sequence "${sequence.name}" (ID: \`${id}\`).`;
    if (args.company) text += ` Company: ${args.company}.`;
    text += `\n\n**Next:** \`set_prospect_hooks\` with prospectId \`${id}\` to add personalization research.`;

    return kit.text(text);
  },
});
