import { nanoid } from "nanoid";
import { z } from "zod";
import { defineTool } from "../../../framework";
import { sequences } from "../schema";

export const createSequence = defineTool({
  name: "create_sequence",
  description: "Create a new email sequence for cold outreach",
  args: z.object({
    name: z.string().describe("Sequence name (e.g., 'Series A founders Q2')"),
    targetPersona: z.string().optional().describe("Who this sequence targets (e.g., 'VP Engineering at mid-market SaaS')"),
    tone: z.string().optional().describe("Writing tone (e.g., 'conversational', 'formal', 'friendly-professional')"),
    status: z.enum(["draft", "active", "paused", "archived"]).optional().default("draft"),
  }),
  handler: async (db, args) => {
    const id = nanoid();
    await db.insert(sequences).values({
      id,
      name: args.name,
      targetPersona: args.targetPersona ?? null,
      tone: args.tone ?? null,
      status: args.status,
    });
    return {
      content: [{ type: "text" as const, text: `Sequence "${args.name}" created (ID: ${id}, status: ${args.status}).${args.targetPersona ? ` Target: ${args.targetPersona}.` : ""}` }],
    };
  },
});
