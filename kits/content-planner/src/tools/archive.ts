import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { ideas, content } from "../schema";

export const archive = defineTool({
  name: "archive",
  description: "Soft-delete an idea or content piece (can be recovered later).",
  args: z.object({
    type: z.enum(["idea", "content"]).describe("Entity type to archive"),
    id: z.string().describe("Entity ID (idea_xxx or cnt_xxx)"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();

    switch (args.type) {
      case "idea":
        await db
          .update(ideas)
          .set({ archivedAt: now, updatedAt: now })
          .where(eq(ideas.id, args.id));
        break;
      case "content":
        await db
          .update(content)
          .set({ archivedAt: now, updatedAt: now })
          .where(eq(content.id, args.id));
        break;
    }

    return kit.result(kit.deleted(args.id, args.type, `${args.type} archived.`));
  },
});
