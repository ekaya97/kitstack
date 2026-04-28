import { nanoid } from "nanoid";
import { z } from "zod";
import { like } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { contacts, companies } from "../schema";

export const addContact = defineTool({
  name: "add_contact",
  description: "Add a new contact, optionally with a company (creates the company if it doesn't exist)",
  args: z.object({
    firstName: z.string().describe("Contact's first name"),
    lastName: z.string().optional().describe("Contact's last name"),
    company: z.string().optional().describe("Company name or ID — creates the company if it doesn't exist"),
    role: z.string().optional().describe("Job title or role"),
    email: z.string().optional().describe("Email address"),
    phone: z.string().optional().describe("Phone number"),
    source: z.string().optional().describe("How you met: event, referral, inbound, outbound, linkedin"),
    relationship: z.string().optional().describe("Relationship warmth: warm, neutral, cold"),
    notes: z.string().optional().describe("Initial notes"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();
    let companyId: string | null = null;
    const fragments = [];

    // Resolve or create company
    if (args.company) {
      if (args.company.startsWith("com_")) {
        companyId = args.company;
      } else {
        // Search by name
        const existing = await db
          .select()
          .from(companies)
          .where(like(companies.name, args.company))
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
          fragments.push(
            kit.created(companyId, "company", `Company "${args.company}" created.`)
          );
        }
      }
    }

    const id = `con_${nanoid()}`;
    await db.insert(contacts).values({
      id,
      companyId,
      firstName: args.firstName,
      lastName: args.lastName ?? null,
      email: args.email ?? null,
      phone: args.phone ?? null,
      role: args.role ?? null,
      source: args.source ?? null,
      relationship: args.relationship ?? "neutral",
      notes: args.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const fullName = args.lastName ? `${args.firstName} ${args.lastName}` : args.firstName;
    fragments.push(
      kit.created(id, "contact", `Contact "${fullName}" added.${args.company ? ` Company: ${args.company}.` : ""}`)
    );

    return kit.result(fragments);
  },
});
