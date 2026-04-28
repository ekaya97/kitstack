import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { contacts } from "../schema";

export const updateContact = defineTool({
  name: "update_contact",
  description: "Update contact details or relationship warmth",
  args: z.object({
    contactId: z.string().describe("Contact ID"),
    firstName: z.string().optional().describe("Updated first name"),
    lastName: z.string().optional().describe("Updated last name"),
    email: z.string().optional().describe("Updated email"),
    phone: z.string().optional().describe("Updated phone"),
    role: z.string().optional().describe("Updated role/title"),
    relationship: z.enum(["warm", "neutral", "cold"]).optional().describe("Relationship warmth"),
    companyId: z.string().optional().describe("Updated company ID"),
    source: z.string().optional().describe("Updated source"),
    notes: z.string().optional().describe("Updated notes"),
    tags: z.string().optional().describe("Updated tags (comma-separated)"),
  }),
  handler: async (db, args) => {
    const existing = await db.select().from(contacts).where(eq(contacts.id, args.contactId)).then(r => r[0]);
    if (!existing) {
      return kit.text(`Contact with ID "${args.contactId}" not found.`);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.role !== undefined) updates.role = args.role;
    if (args.relationship !== undefined) updates.relationship = args.relationship;
    if (args.companyId !== undefined) updates.companyId = args.companyId;
    if (args.source !== undefined) updates.source = args.source;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.tags !== undefined) updates.tags = args.tags;

    if (Object.keys(updates).length <= 1) {
      return kit.text("No changes specified.");
    }

    await db.update(contacts).set(updates).where(eq(contacts.id, args.contactId));
    const name = `${existing.firstName} ${existing.lastName ?? ""}`.trim();
    const changes = Object.entries(updates)
      .filter(([k]) => k !== "updatedAt")
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    return kit.result(
      kit.updated(args.contactId, "contact", `Contact "${name}" updated — ${changes}.`)
    );
  },
});
