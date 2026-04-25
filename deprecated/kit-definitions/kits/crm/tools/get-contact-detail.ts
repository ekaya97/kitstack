import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { contacts, deals, activities } from "../schema";

export const getContactDetail = defineTool({
  name: "get_contact_detail",
  description: "Get full contact details including deals and activity history",
  args: z.object({
    contactId: z.string().describe("Contact ID"),
  }),
  handler: async (db, args) => {
    const contact = await db.select().from(contacts).where(eq(contacts.id, args.contactId)).then((r: any[]) => r[0]);
    if (!contact) {
      return { content: [{ type: "text" as const, text: "Contact not found." }], isError: true };
    }

    const contactDeals = await db.select().from(deals).where(eq(deals.contactId, args.contactId)).orderBy(desc(deals.createdAt));
    const contactActivities = await db.select().from(activities).where(eq(activities.contactId, args.contactId)).orderBy(desc(activities.createdAt)).limit(10);

    let text = `# ${contact.name}\n`;
    if (contact.company) text += `**Company:** ${contact.company}\n`;
    if (contact.email) text += `**Email:** ${contact.email}\n`;
    if (contact.phone) text += `**Phone:** ${contact.phone}\n`;
    if (contact.source) text += `**Source:** ${contact.source}\n`;
    if (contact.lastContactedAt) text += `**Last contacted:** ${contact.lastContactedAt}\n`;
    if (contact.notes) text += `\n**Notes:** ${contact.notes}\n`;

    if (contactDeals.length > 0) {
      text += `\n## Deals (${contactDeals.length})\n`;
      for (const d of contactDeals) {
        const val = d.value ? `€${d.value.toLocaleString()}` : "no value";
        text += `- **${d.name}** — ${d.stage} (${val})\n`;
      }
    }

    if (contactActivities.length > 0) {
      text += `\n## Recent Activity\n`;
      for (const a of contactActivities) {
        text += `- [${a.type}] ${a.description}\n`;
      }
    }

    return { content: [{ type: "text" as const, text }] };
  },
});
