import { nanoid } from "nanoid";
import { z } from "zod";
import { defineTool, kit } from "../sdk";
import { contacts } from "../schema";

export const addContact = defineTool({
  name: "add_contact",
  description: "Add a new contact to the CRM",
  args: z.object({
    name: z.string().describe("Contact's full name"),
    company: z.string().optional().describe("Company name"),
    email: z.string().optional().describe("Email address"),
    phone: z.string().optional().describe("Phone number"),
    source: z.string().optional().describe("How you met (e.g., 'LinkedIn', 'referral', 'conference')"),
    notes: z.string().optional().describe("Initial notes"),
  }),
  handler: async (db, args, ctx) => {
    const id = nanoid();
    await db.insert(contacts).values({
      id,
      name: args.name,
      company: args.company ?? null,
      email: args.email ?? null,
      phone: args.phone ?? null,
      source: args.source ?? null,
      notes: args.notes ?? null,
    });
    return kit.result(
      kit.created(id, "contact", `Contact "${args.name}" added.${args.company ? ` Company: ${args.company}.` : ""}`)
    );
  },
});
