import { z } from "zod";
import { eq, isNotNull, lte, gte, desc, asc } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { interactions, contacts } from "../schema";

export const followUps = defineTool({
  name: "follow_ups",
  description: "Show overdue and upcoming follow-ups",
  args: z.object({
    days_ahead: z.number().optional().default(7).describe("How many days ahead to look (default 7)"),
  }),
  handler: async (db, args) => {
    const today = new Date().toISOString().slice(0, 10);
    const ahead = new Date(Date.now() + args.days_ahead * 86400000).toISOString().slice(0, 10);

    // Get all interactions that have follow-ups with deadlines
    const rows = await db
      .select({
        id: interactions.id,
        contactId: interactions.contactId,
        followUp: interactions.followUp,
        followUpBy: interactions.followUpBy,
        summary: interactions.summary,
        type: interactions.type,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(interactions)
      .innerJoin(contacts, eq(interactions.contactId, contacts.id))
      .where(isNotNull(interactions.followUpBy))
      .orderBy(asc(interactions.followUpBy))
      .limit(50);

    // Filter: overdue or upcoming within days_ahead
    const overdue = rows.filter((r) => r.followUpBy! < today);
    const upcoming = rows.filter((r) => r.followUpBy! >= today && r.followUpBy! <= ahead);

    if (overdue.length === 0 && upcoming.length === 0) {
      return kit.text("No follow-ups due. You're all caught up!");
    }

    const sections: string[] = [];

    if (overdue.length > 0) {
      let table = `### Overdue (${overdue.length})\n\n| Contact | Due | Action | From |\n|---------|-----|--------|------|\n`;
      for (const r of overdue) {
        const name = `${r.firstName} ${r.lastName || ""}`.trim();
        table += `| ${name} | ${r.followUpBy} | ${r.followUp} | ${r.type}: ${r.summary.slice(0, 50)} |\n`;
      }
      sections.push(table);
    }

    if (upcoming.length > 0) {
      let table = `### Upcoming (${upcoming.length})\n\n| Contact | Due | Action | From |\n|---------|-----|--------|------|\n`;
      for (const r of upcoming) {
        const name = `${r.firstName} ${r.lastName || ""}`.trim();
        table += `| ${name} | ${r.followUpBy} | ${r.followUp} | ${r.type}: ${r.summary.slice(0, 50)} |\n`;
      }
      sections.push(table);
    }

    return kit.text(sections.join("\n"));
  },
});
