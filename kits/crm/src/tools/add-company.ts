import { z } from "zod";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { companies } from "../schema";

export const addCompany = defineTool({
  name: "add_company",
  description: "Add a new company to the CRM",
  args: z.object({
    name: z.string().describe("Company name"),
    domain: z.string().optional().describe("Website domain"),
    industry: z.string().optional().describe("Industry or sector"),
    size: z.string().optional().describe("Company size: solo, 2-10, 11-50, 51-200, 201-1000, 1000+"),
    notes: z.string().optional().describe("Notes about the company"),
    tags: z.string().optional().describe("Comma-separated tags"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();
    const id = `com_${nanoid()}`;

    await db.insert(companies).values({
      id,
      name: args.name,
      domain: args.domain ?? null,
      industry: args.industry ?? null,
      size: args.size ?? null,
      notes: args.notes ?? null,
      tags: args.tags ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return kit.result(kit.created(id, "company", `Company "${args.name}" added.`));
  },
});
