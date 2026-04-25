import { z } from "zod";
import { defineTool, kit } from "../sdk";
import { getContactDetail } from "../queries/contacts";

export const getContactDetailTool = defineTool({
  name: "get_contact_detail",
  description: "Get full contact details including deals and activity history",
  args: z.object({
    contactId: z.string().describe("Contact ID"),
  }),
  handler: async (db, args, ctx) => {
    const result = await getContactDetail(db, args.contactId);

    if (!result) {
      return kit.notFound("Contact", args.contactId);
    }

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
