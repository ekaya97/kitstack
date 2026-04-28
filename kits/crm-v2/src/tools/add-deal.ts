import { nanoid } from "nanoid";
import { z } from "zod";
import { defineTool, kit } from "../sdk";
import { deals } from "../schema";

export const addDeal = defineTool({
  name: "add_deal",
  description: "Create a new deal in the pipeline",
  args: z.object({
    title: z.string().describe("Deal title"),
    contactId: z.string().optional().describe("Associated contact ID"),
    companyId: z.string().optional().describe("Associated company ID"),
    valueCents: z.number().optional().describe("Deal value in cents (e.g., 2500000 for €25,000)"),
    currency: z.string().optional().describe("Currency code (default: EUR)"),
    stage: z.enum(["lead", "contacted", "proposal", "negotiation", "won", "lost"]).optional().describe("Pipeline stage"),
    probability: z.number().optional().describe("Win probability 0-100"),
    expectedClose: z.string().optional().describe("Expected close date (ISO date)"),
    notes: z.string().optional().describe("Deal notes"),
  }),
  handler: async (db, args) => {
    const id = `deal_${nanoid()}`;
    const now = new Date().toISOString();
    await db.insert(deals).values({
      id,
      contactId: args.contactId ?? null,
      companyId: args.companyId ?? null,
      title: args.title,
      valueCents: args.valueCents ?? null,
      currency: args.currency ?? "EUR",
      stage: args.stage ?? "lead",
      probability: args.probability ?? null,
      expectedClose: args.expectedClose ?? null,
      notes: args.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const valueStr = args.valueCents
      ? ` — ${args.currency ?? "€"}${(args.valueCents / 100).toLocaleString()}`
      : "";

    return kit.result(
      kit.created(id, "deal", `Deal "${args.title}" created in ${args.stage ?? "lead"}${valueStr}.`)
    );
  },
});
