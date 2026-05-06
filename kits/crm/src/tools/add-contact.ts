import { z } from "zod";
import { like, eq, isNull } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { contacts, companies } from "../schema";
import type { KitResultFragment } from "@kitstackco/sdk";

export const addContact = defineTool({
  name: "add_contact",
  description: "Add a new contact, optionally with a company (creates the company if it doesn't exist)",
  args: z.object({
    first_name: z.string().describe("Contact's first name"),
    last_name: z.string().optional().describe("Contact's last name"),
    company: z.string().optional().describe("Company name or ID (com_xxx). Creates company if name doesn't exist."),
    role: z.string().optional().describe("Job title or role"),
    email: z.string().optional().describe("Email address"),
    phone: z.string().optional().describe("Phone number"),
    source: z.string().optional().describe("How you met: event, referral, inbound, outbound, linkedin"),
    relationship: z.string().optional().describe("Relationship warmth: warm, neutral, cold"),
    notes: z.string().optional().describe("Notes about the contact"),
    tags: z.string().optional().describe("Comma-separated tags"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();
    const fragments: KitResultFragment[] = [];
    let companyId: string | null = null;

    // Resolve company: ID, name match, or implicit creation
    if (args.company) {
      if (args.company.startsWith("com_")) {
        companyId = args.company;
      } else {
        const existing = await db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(like(companies.name, `%${args.company}%`))
          .limit(1);

        if (existing.length > 0) {
          companyId = existing[0].id;
        } else {
          // Implicit company creation
          companyId = `com_${nanoid()}`;
          await db.insert(companies).values({
            id: companyId,
            name: args.company,
            createdAt: now,
            updatedAt: now,
          });
          fragments.push(kit.created(companyId, "company", `Company "${args.company}" created.`));
        }
      }
    }

    const contactId = `con_${nanoid()}`;
    await db.insert(contacts).values({
      id: contactId,
      companyId,
      firstName: args.first_name,
      lastName: args.last_name ?? null,
      email: args.email ?? null,
      phone: args.phone ?? null,
      role: args.role ?? null,
      relationship: args.relationship ?? "neutral",
      source: args.source ?? null,
      notes: args.notes ?? null,
      tags: args.tags ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const name = [args.first_name, args.last_name].filter(Boolean).join(" ");
    fragments.push(kit.created(contactId, "contact", `Contact "${name}" added.${companyId && !args.company?.startsWith("com_") ? "" : ""}`));

    return kit.result(fragments);
  },
});
