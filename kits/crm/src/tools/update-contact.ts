import { z } from "zod";
import { eq, like, or } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { contacts } from "../schema";

export const updateContact = defineTool({
  name: "update_contact",
  description: "Update contact details or relationship warmth",
  args: z.object({
    contact: z.string().describe("Contact ID (con_xxx) or name for fuzzy match"),
    first_name: z.string().optional().describe("Updated first name"),
    last_name: z.string().optional().describe("Updated last name"),
    email: z.string().optional().describe("Updated email"),
    phone: z.string().optional().describe("Updated phone"),
    role: z.string().optional().describe("Updated role/title"),
    relationship: z.string().optional().describe("Relationship warmth: warm, neutral, cold"),
    company_id: z.string().optional().describe("New company ID (com_xxx)"),
    source: z.string().optional().describe("Updated source"),
    notes: z.string().optional().describe("Updated notes"),
    tags: z.string().optional().describe("Updated comma-separated tags"),
  }),
  handler: async (db, args) => {
    let contactId: string;
    if (args.contact.startsWith("con_")) {
      contactId = args.contact;
    } else {
      const matches = await db
        .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
        .from(contacts)
        .where(or(like(contacts.firstName, `%${args.contact}%`), like(contacts.lastName, `%${args.contact}%`)))
        .limit(5);

      if (matches.length === 0) return kit.error(`No contact found matching "${args.contact}".`);
      if (matches.length > 1) {
        const list = matches.map((c) => `• ${c.firstName} ${c.lastName || ""} (${c.id})`).join("\n");
        return kit.text(`Multiple contacts match. Please specify:\n${list}`);
      }
      contactId = matches[0].id;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.first_name !== undefined) updates.firstName = args.first_name;
    if (args.last_name !== undefined) updates.lastName = args.last_name;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.role !== undefined) updates.role = args.role;
    if (args.relationship !== undefined) updates.relationship = args.relationship;
    if (args.company_id !== undefined) updates.companyId = args.company_id;
    if (args.source !== undefined) updates.source = args.source;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.tags !== undefined) updates.tags = args.tags;

    await db.update(contacts).set(updates).where(eq(contacts.id, contactId));

    const changes = Object.keys(updates).filter((k) => k !== "updatedAt").join(", ");
    return kit.result(kit.updated(contactId, "contact", `Contact updated: ${changes}.`));
  },
});
