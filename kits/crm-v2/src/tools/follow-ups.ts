import { z } from "zod";
import { and, isNotNull, lte, gte, eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { interactions, contacts } from "../schema";

const followUpsArgs = z.object({
  daysAhead: z.number().optional().default(7).describe("Show follow-ups due within this many days"),
});

export async function loadFollowUps(db: LibSQLDatabase, args: z.infer<typeof followUpsArgs>, ctx: KitContext) {
  const today = new Date().toISOString().split("T")[0];
  const futureDate = new Date(Date.now() + args.daysAhead * 86400000).toISOString().split("T")[0];

  return db
    .select({
      id: interactions.id,
      contactId: interactions.contactId,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      type: interactions.type,
      summary: interactions.summary,
      followUp: interactions.followUp,
      followUpBy: interactions.followUpBy,
      occurredAt: interactions.occurredAt,
    })
    .from(interactions)
    .innerJoin(contacts, eq(interactions.contactId, contacts.id))
    .where(
      and(
        isNotNull(interactions.followUp),
        isNotNull(interactions.followUpBy),
        lte(interactions.followUpBy, futureDate)
      )
    )
    .orderBy(interactions.followUpBy);
}

export const followUps = defineTool({
  name: "follow_ups",
  description: "Show overdue and upcoming follow-ups",
  args: followUpsArgs,
  load: loadFollowUps,
  handler: async (db, args, ctx) => {
    const result = await loadFollowUps(db, args, ctx);
    if (result.length === 0) {
      return kit.text("No follow-ups due. You're all caught up!");
    }

    const today = new Date().toISOString().split("T")[0];
    const overdue = result.filter(r => r.followUpBy! < today);
    const upcoming = result.filter(r => r.followUpBy! >= today);

    let text = "## Follow-Ups\n\n";

    if (overdue.length > 0) {
      text += `### Overdue (${overdue.length})\n\n`;
      for (const r of overdue) {
        const name = `${r.contactFirstName} ${r.contactLastName ?? ""}`.trim();
        text += `- **${name}** — ${r.followUp} (due ${r.followUpBy}, from ${r.type}: "${r.summary}")\n`;
      }
      text += "\n";
    }

    if (upcoming.length > 0) {
      text += `### Upcoming (${upcoming.length})\n\n`;
      for (const r of upcoming) {
        const name = `${r.contactFirstName} ${r.contactLastName ?? ""}`.trim();
        text += `- **${name}** — ${r.followUp} (due ${r.followUpBy})\n`;
      }
    }

    return kit.text(text);
  },
});
