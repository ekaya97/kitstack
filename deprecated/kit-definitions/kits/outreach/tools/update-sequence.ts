import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { sequences } from "../schema";

export const updateSequence = defineTool({
  name: "update_sequence",
  description: "Update a sequence's name, status, target persona, or tone",
  args: z.object({
    sequenceId: z.string().describe("Sequence ID"),
    name: z.string().optional().describe("New sequence name (e.g., 'Series A founders Q2')"),
    status: z.enum(["draft", "active", "paused", "archived"]).optional().describe("Transition status: draft → active → paused → archived"),
    targetPersona: z.string().optional().describe("Describe the intended recipient archetype. Be specific enough to guide tone (e.g., 'VPs of Engineering at Series B SaaS, 200-800 FTE, DACH region')."),
    tone: z.string().optional().describe("Freeform voice instructions: register, rhythm, things to avoid (e.g., 'Direct, peer-to-peer, no marketing jargon, lead with a concrete pain point')."),
  }),
  handler: async (db, args) => {
    const existing = await db.select().from(sequences).where(eq(sequences.id, args.sequenceId)).then((r: any[]) => r[0]);
    if (!existing) {
      return { content: [{ type: "text" as const, text: `Sequence not found. Use list_sequences to see valid IDs.` }], isError: true };
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.status !== undefined) updates.status = args.status;
    if (args.targetPersona !== undefined) updates.targetPersona = args.targetPersona;
    if (args.tone !== undefined) updates.tone = args.tone;

    if (Object.keys(updates).length === 0) {
      return { content: [{ type: "text" as const, text: "No changes specified." }] };
    }

    await db.update(sequences).set(updates).where(eq(sequences.id, args.sequenceId));

    const changes = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(", ");
    return {
      content: [{ type: "text" as const, text: `Sequence "${existing.name}" updated — ${changes}.` }],
    };
  },
});
