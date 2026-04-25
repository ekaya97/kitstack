import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../../../packages/mcp-server/src/framework";
import { prospects } from "../schema";

export const personalizeForProspect = defineTool({
  name: "set_prospect_hooks",
  description: "Store personalization research for a prospect — recent posts, company news, mutual connections, or any key-value context for email personalization",
  args: z.object({
    prospectId: z.string().describe("Prospect ID"),
    hooks: z.record(z.string(), z.string()).describe("Key-value pairs of personalization hooks (e.g., { 'recent_post': 'Wrote about AI in sales', 'mutual': 'John from Acme' })"),
  }),
  handler: async (db, args) => {
    const prospect = await db.select().from(prospects).where(eq(prospects.id, args.prospectId)).then((r: any[]) => r[0]);
    if (!prospect) {
      return { content: [{ type: "text" as const, text: `Prospect not found. Use export_sequence to see prospect IDs.` }], isError: true };
    }

    let existingHooks: Record<string, string> = {};
    if (prospect.personalizationHooks) {
      try {
        existingHooks = JSON.parse(prospect.personalizationHooks);
      } catch {
        existingHooks = {};
      }
    }

    const merged = { ...existingHooks, ...args.hooks };
    await db.update(prospects).set({ personalizationHooks: JSON.stringify(merged) }).where(eq(prospects.id, args.prospectId));

    const hookCount = Object.keys(merged).length;
    const hookSummary = Object.entries(args.hooks).map(([k, v]) => `${k}: ${v}`).join(", ");
    let text = `Personalization hooks updated for "${prospect.name}" (${hookCount} total). Added: ${hookSummary}.`;
    text += `\n\n**Next:** \`export_sequence\` to see the full sequence with hooks, or \`kit_view(id="cold-outreach", view="prospect-list")\` for interactive UI.`;

    return { content: [{ type: "text" as const, text }] };
  },
});
