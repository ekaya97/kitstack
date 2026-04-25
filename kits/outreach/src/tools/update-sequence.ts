import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { sequences } from "../schema";

export const updateSequence = defineTool({
  name: "update_sequence",
  description: "Update a sequence's name, status, target persona, or tone",
  args: z.object({
    sequenceId: z.string().describe("Sequence ID"),
    name: z.string().optional().describe("New sequence name"),
    status: z.enum(["draft", "active", "paused", "archived"]).optional().describe("Transition status: draft → active → paused → archived"),
    targetPersona: z.string().optional().describe("Describe the intended recipient archetype"),
    tone: z.string().optional().describe("Freeform voice instructions"),
  }),
  handler: async (db, args, ctx) => {
    const existing = await db.select().from(sequences).where(eq(sequences.id, args.sequenceId)).then((r) => r[0] ?? null);
    if (!existing) return kit.notFound("Sequence", args.sequenceId);

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.status !== undefined) updates.status = args.status;
    if (args.targetPersona !== undefined) updates.targetPersona = args.targetPersona;
    if (args.tone !== undefined) updates.tone = args.tone;

    if (Object.keys(updates).length === 0) {
      return kit.text("No changes specified.");
    }

    await db.update(sequences).set(updates).where(eq(sequences.id, args.sequenceId));

    const changes = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(", ");
    return kit.text(`Sequence "${existing.name}" updated — ${changes}.`);
  },
});
