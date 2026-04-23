import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool } from "../../../framework";
import { prospects } from "../schema";

export const personalizeForProspect = defineTool({
  name: "personalize_for_prospect",
  description: "Store personalization hooks for a prospect (e.g., recent posts, company news, mutual connections)",
  args: z.object({
    prospectId: z.string().describe("Prospect ID"),
    hooks: z.record(z.string(), z.string()).describe("Key-value pairs of personalization hooks (e.g., { 'recent_post': 'Wrote about AI in sales', 'mutual': 'John from Acme' })"),
  }),
  handler: async (db, args) => {
    const prospect = await db.select().from(prospects).where(eq(prospects.id, args.prospectId)).then((r: any[]) => r[0]);
    if (!prospect) {
      return { content: [{ type: "text" as const, text: "Prospect not found." }], isError: true };
    }

    // Merge with existing hooks if any
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
    return {
      content: [{ type: "text" as const, text: `Personalization hooks updated for "${prospect.name}" (${hookCount} total). Added: ${hookSummary}.` }],
    };
  },
});
