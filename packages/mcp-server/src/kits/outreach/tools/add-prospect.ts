import { nanoid } from "nanoid";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { sequences, prospects } from "../schema";

export const addProspect = defineTool({
  name: "add_prospect",
  description: "Add a prospect to an outreach sequence",
  args: z.object({
    sequenceId: z.string().describe("Sequence ID"),
    name: z.string().describe("Prospect's full name"),
    company: z.string().optional().describe("Company name"),
    email: z.string().optional().describe("Email address"),
    linkedinUrl: z.string().optional().describe("LinkedIn profile URL"),
    status: z.enum(["pending", "contacted", "replied", "bounced", "opted_out"]).optional().default("pending"),
  }),
  handler: async (db, args) => {
    const sequence = await db.select().from(sequences).where(eq(sequences.id, args.sequenceId)).then((r: any[]) => r[0]);
    if (!sequence) {
      return { content: [{ type: "text" as const, text: "Sequence not found." }], isError: true };
    }

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

    return {
      content: [{ type: "text" as const, text: `Prospect "${args.name}" added to sequence "${sequence.name}" (ID: ${id}).${args.company ? ` Company: ${args.company}.` : ""}` }],
    };
  },
});
