import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "../sdk";
import type { KitContext } from "../sdk";
import { contacts, deals, activities } from "../schema";

const getContactDetailArgs = z.object({
  contactId: z.string().describe("Contact ID"),
});

async function loadContactDetail(db: LibSQLDatabase, args: z.infer<typeof getContactDetailArgs>, ctx: KitContext) {
  const contact = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, args.contactId))
    .then((r) => r[0] ?? null);

  if (!contact) return null;

  const contactDeals = await db
    .select()
    .from(deals)
    .where(eq(deals.contactId, args.contactId))
    .orderBy(desc(deals.createdAt));

  const recentActivities = await db
    .select()
    .from(activities)
    .where(eq(activities.contactId, args.contactId))
    .orderBy(desc(activities.createdAt))
    .limit(15);

  return { contact, deals: contactDeals, recentActivities };
}

export const getContactDetailTool = defineTool({
  name: "get_contact_detail",
  description: "Get full contact details including deals and activity history",
  args: getContactDetailArgs,
  load: loadContactDetail,

  handler: async (db, args, ctx) => {
    const result = await loadContactDetail(db, args, ctx);
    if (!result) return kit.notFound("Contact", args.contactId);

    const { contact, deals, recentActivities } = result;

    let text = `# ${contact.name}\n`;
    if (contact.company) text += `**Company:** ${contact.company}\n`;
    if (contact.email) text += `**Email:** ${contact.email}\n`;
    if (contact.phone) text += `**Phone:** ${contact.phone}\n`;
    if (contact.source) text += `**Source:** ${contact.source}\n`;
    if (contact.lastContactedAt) text += `**Last contacted:** ${contact.lastContactedAt}\n`;
    if (contact.notes) text += `\n**Notes:** ${contact.notes}\n`;

    if (deals.length > 0) {
      text += `\n## Deals (${deals.length})\n`;
      for (const d of deals) {
        const val = d.value ? `€${d.value.toLocaleString()}` : "no value";
        text += `- **${d.name}** (ID: \`${d.id}\`) — ${d.stage} (${val})\n`;
      }
    }

    if (recentActivities.length > 0) {
      text += `\n## Recent Activity\n`;
      for (const a of recentActivities) {
        text += `- [${a.type}] ${a.description}\n`;
      }
    }

    return kit.text(text);
  },
});
