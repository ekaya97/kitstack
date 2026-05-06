import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { contacts, companies, deals } from "../schema";

export const archive = defineTool({
  name: "archive",
  description: "Soft-delete a contact, company, or deal (can be recovered later)",
  args: z.object({
    type: z.enum(["contact", "company", "deal"]).describe("Entity type to archive"),
    id: z.string().describe("Entity ID (con_xxx, com_xxx, or deal_xxx)"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();

    switch (args.type) {
      case "contact":
        await db.update(contacts).set({ archivedAt: now, updatedAt: now }).where(eq(contacts.id, args.id));
        break;
      case "company":
        await db.update(companies).set({ archivedAt: now, updatedAt: now }).where(eq(companies.id, args.id));
        break;
      case "deal":
        await db.update(deals).set({ archivedAt: now, updatedAt: now }).where(eq(deals.id, args.id));
        break;
    }

    return kit.result(kit.deleted(args.id, args.type, `${args.type} ${args.id} archived.`));
  },
});
