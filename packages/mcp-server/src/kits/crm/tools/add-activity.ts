import { nanoid } from "nanoid";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { activities, contacts } from "../schema";

export const addActivity = defineTool({
  name: "add_activity",
  description: "Log an activity (call, email, meeting, note, task) for a contact or deal",
  args: z.object({
    contactId: z.string().optional().describe("Contact ID"),
    dealId: z.string().optional().describe("Deal ID"),
    type: z.enum(["call", "email", "meeting", "note", "task"]).describe("Activity type"),
    description: z.string().describe("What happened"),
  }),
  handler: async (db, args) => {
    const id = nanoid();
    await db.insert(activities).values({
      id,
      contactId: args.contactId ?? null,
      dealId: args.dealId ?? null,
      type: args.type,
      description: args.description,
    });

    // Update last_contacted_at on the contact
    if (args.contactId) {
      await db
        .update(contacts)
        .set({ lastContactedAt: new Date().toISOString().split("T")[0] })
        .where(eq(contacts.id, args.contactId));
    }

    return { content: [{ type: "text" as const, text: `${args.type} logged: "${args.description}"` }] };
  },
});
