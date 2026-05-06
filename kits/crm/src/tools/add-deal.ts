import { z } from "zod";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { deals } from "../schema";

export const addDeal = defineTool({
  name: "add_deal",
  description: "Create a new deal in the pipeline",
  args: z.object({
    title: z.string().describe("Deal title"),
    contact_id: z.string().optional().describe("Contact ID (con_xxx)"),
    company_id: z.string().optional().describe("Company ID (com_xxx)"),
    value: z.number().optional().describe("Deal value in cents (integer)"),
    currency: z.string().optional().default("EUR").describe("Currency code"),
    stage: z.string().optional().default("lead").describe("Stage: lead, contacted, proposal, negotiation, won, lost"),
    probability: z.number().optional().describe("Win probability 0-100"),
    expected_close: z.string().optional().describe("Expected close date (ISO)"),
    notes: z.string().optional().describe("Notes about the deal"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();
    const id = `deal_${nanoid()}`;

    await db.insert(deals).values({
      id,
      contactId: args.contact_id ?? null,
      companyId: args.company_id ?? null,
      title: args.title,
      valueCents: args.value ?? null,
      currency: args.currency,
      stage: args.stage,
      probability: args.probability ?? null,
      expectedClose: args.expected_close ?? null,
      notes: args.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const valueStr = args.value ? ` — ${args.currency} ${(args.value / 100).toFixed(2)}` : "";
    return kit.result(kit.created(id, "deal", `Deal "${args.title}" created${valueStr}.`));
  },
});
