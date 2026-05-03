import { nanoid } from "nanoid";
import { z } from "zod";
import { defineTool } from "../../../framework";
import { deals } from "../schema";

export const addDeal = defineTool({
  name: "add_deal",
  description: "Create a new deal in the pipeline",
  args: z.object({
    name: z.string().describe("Deal name"),
    contactId: z.string().optional().describe("Associated contact ID"),
    value: z.number().optional().describe("Deal value in EUR"),
    stage: z.enum(["prospect", "proposal", "negotiation", "won", "lost"]).optional().default("prospect"),
    notes: z.string().optional(),
    expectedCloseDate: z.string().optional().describe("Expected close date (YYYY-MM-DD)"),
  }),
  handler: async (db, args) => {
    const id = nanoid();
    await db.insert(deals).values({
      id,
      name: args.name,
      contactId: args.contactId ?? null,
      value: args.value ?? null,
      stage: args.stage,
      notes: args.notes ?? null,
      expectedCloseDate: args.expectedCloseDate ?? null,
    });
    const valueStr = args.value ? ` — €${args.value.toLocaleString()}` : "";
    return {
      content: [{ type: "text" as const, text: `Deal "${args.name}" created in ${args.stage}${valueStr}.` }],
    };
  },
});
