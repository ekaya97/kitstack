import { nanoid } from "nanoid";
import { z } from "zod";
import { defineTool, kit } from "../sdk";
import { sequences } from "../schema";

export const createSequence = defineTool({
  name: "create_sequence",
  description: "Create a new email sequence for cold outreach",
  args: z.object({
    name: z.string().describe("Sequence name (e.g., 'Series A founders Q2')"),
    targetPersona: z.string().optional().describe("Describe the intended recipient archetype. Be specific enough to guide tone (e.g., 'VPs of Engineering at Series B SaaS, 200-800 FTE, DACH region')."),
    tone: z.string().optional().describe("Freeform voice instructions: register, rhythm, things to avoid (e.g., 'Direct, peer-to-peer, no marketing jargon, lead with a concrete pain point')."),
    status: z.enum(["draft", "active", "paused", "archived"]).optional().default("draft"),
  }),
  handler: async (db, args, ctx) => {
    const id = nanoid();
    await db.insert(sequences).values({
      id,
      name: args.name,
      targetPersona: args.targetPersona ?? null,
      tone: args.tone ?? null,
      status: args.status,
    });

    let text = `Sequence "${args.name}" created (ID: \`${id}\`, status: ${args.status}).`;
    if (args.targetPersona) text += ` Target: ${args.targetPersona}.`;
    text += `\n\n**Next:** \`add_emails\` with sequenceId \`${id}\` to add emails to this sequence.`;

    return kit.text(text);
  },
});
