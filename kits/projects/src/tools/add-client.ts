import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { nanoid } from "nanoid";
import { clients } from "../schema";

export const addClient = defineTool({
  name: "add_client",
  description: "Add a new client (company or person you do work for)",
  args: z.object({
    name: z.string().describe("Client or company name"),
    contact_name: z.string().describe("Primary contact person's name").optional(),
    contact_email: z.string().describe("Contact email address").optional(),
    industry: z.string().describe("Industry or sector").optional(),
    notes: z.string().describe("Any notes about this client").optional(),
  }),
  handler: async (db, args) => {
    const id = `cli_${nanoid()}`;
    const now = new Date().toISOString();
    await db.insert(clients).values({
      id,
      name: args.name,
      contactName: args.contact_name ?? null,
      contactEmail: args.contact_email ?? null,
      industry: args.industry ?? null,
      notes: args.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return kit.result(kit.created(id, "client", `Client "${args.name}" added.`));
  },
});
