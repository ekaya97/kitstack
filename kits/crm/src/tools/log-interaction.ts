import { z } from "zod";
import { like, or, isNull } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { contacts, interactions } from "../schema";

export const logInteraction = defineTool({
  name: "log_interaction",
  description: "Log a conversation, meeting, or touchpoint with a contact",
  args: z.object({
    contact: z.string().describe("Contact name or ID (con_xxx). Fuzzy matches by first/last name."),
    type: z.string().describe("Interaction type: call, email, meeting, coffee, linkedin, event, note"),
    summary: z.string().describe("What happened"),
    sentiment: z.string().optional().describe("Sentiment: positive, neutral, negative"),
    follow_up: z.string().optional().describe("What to do next"),
    follow_up_by: z.string().optional().describe("Follow-up deadline (ISO date)"),
    occurred_at: z.string().optional().describe("When it happened (ISO date). Defaults to now."),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();

    // Resolve contact by ID or fuzzy name match
    let contactId: string;
    if (args.contact.startsWith("con_")) {
      contactId = args.contact;
    } else {
      const matches = await db
        .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName })
        .from(contacts)
        .where(
          or(
            like(contacts.firstName, `%${args.contact}%`),
            like(contacts.lastName, `%${args.contact}%`)
          )
        )
        .limit(5);

      if (matches.length === 0) {
        return kit.error(`No contact found matching "${args.contact}". Add them first with add_contact.`);
      }
      if (matches.length > 1) {
        const list = matches.map((m) => `• ${m.firstName} ${m.lastName || ""} (${m.id})`).join("\n");
        return kit.text(`Multiple contacts match "${args.contact}". Please specify:\n${list}`);
      }
      contactId = matches[0].id;
    }

    const id = `int_${nanoid()}`;
    await db.insert(interactions).values({
      id,
      contactId,
      type: args.type,
      summary: args.summary,
      sentiment: args.sentiment ?? null,
      followUp: args.follow_up ?? null,
      followUpBy: args.follow_up_by ?? null,
      occurredAt: args.occurred_at ?? now,
      createdAt: now,
      updatedAt: now,
    });

    return kit.result(kit.created(id, "interaction", `${args.type} logged for contact ${contactId}.`));
  },
});
