import { nanoid } from "nanoid";
import { z } from "zod";
import { like, or, eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { interactions, contacts } from "../schema";

export const logInteraction = defineTool({
  name: "log_interaction",
  description: "Log a conversation, meeting, or touchpoint with a contact",
  args: z.object({
    contact: z.string().describe("Contact name or ID"),
    type: z.enum(["call", "email", "meeting", "coffee", "linkedin", "event", "note"]).describe("Interaction type"),
    summary: z.string().describe("What happened"),
    sentiment: z.enum(["positive", "neutral", "negative"]).optional().describe("How did it go?"),
    followUp: z.string().optional().describe("What to do next, if anything"),
    followUpBy: z.string().optional().describe("Follow-up deadline (ISO date, e.g. 2026-05-15)"),
    occurredAt: z.string().optional().describe("When it happened (ISO date). Defaults to today."),
  }),
  handler: async (db, args) => {
    // Resolve contact by ID or name
    let contactId: string;
    if (args.contact.startsWith("con_")) {
      contactId = args.contact;
    } else {
      const matches = await db
        .select()
        .from(contacts)
        .where(
          or(
            like(contacts.firstName, `%${args.contact}%`),
            like(contacts.lastName, `%${args.contact}%`)
          )
        )
        .limit(5);

      if (matches.length === 0) {
        return kit.text(`No contact found matching "${args.contact}". Use add_contact to create one first.`);
      }
      if (matches.length > 1) {
        const list = matches.map(c => `- ${c.firstName} ${c.lastName ?? ""} (${c.id})`).join("\n");
        return kit.text(`Multiple contacts match "${args.contact}":\n${list}\n\nSpecify the ID to disambiguate.`);
      }
      contactId = matches[0].id;
    }

    const id = `int_${nanoid()}`;
    const now = new Date().toISOString();
    await db.insert(interactions).values({
      id,
      contactId,
      type: args.type,
      summary: args.summary,
      sentiment: args.sentiment ?? null,
      followUp: args.followUp ?? null,
      followUpBy: args.followUpBy ?? null,
      occurredAt: args.occurredAt ?? now.split("T")[0],
      createdAt: now,
      updatedAt: now,
    });

    return kit.result(
      kit.created(id, "interaction", `${args.type} logged: "${args.summary}"${args.followUp ? ` — Follow up: ${args.followUp}` : ""}`)
    );
  },
});
