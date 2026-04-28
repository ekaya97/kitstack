import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "../sdk";
import { contacts, companies, deals } from "../schema";

export const archive = defineTool({
  name: "archive",
  description: "Soft-delete a contact, company, or deal (can be recovered later)",
  args: z.object({
    entityType: z.enum(["contact", "company", "deal"]).describe("Type of entity to archive"),
    id: z.string().describe("Entity ID"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();

    switch (args.entityType) {
      case "contact": {
        const existing = await db.select().from(contacts).where(eq(contacts.id, args.id)).then(r => r[0]);
        if (!existing) return kit.text(`Contact "${args.id}" not found.`);
        await db.update(contacts).set({ archivedAt: now }).where(eq(contacts.id, args.id));
        const name = `${existing.firstName} ${existing.lastName ?? ""}`.trim();
        return kit.result(kit.deleted(args.id, "contact", `Contact "${name}" archived.`));
      }
      case "company": {
        const existing = await db.select().from(companies).where(eq(companies.id, args.id)).then(r => r[0]);
        if (!existing) return kit.text(`Company "${args.id}" not found.`);
        await db.update(companies).set({ archivedAt: now }).where(eq(companies.id, args.id));
        return kit.result(kit.deleted(args.id, "company", `Company "${existing.name}" archived.`));
      }
      case "deal": {
        const existing = await db.select().from(deals).where(eq(deals.id, args.id)).then(r => r[0]);
        if (!existing) return kit.text(`Deal "${args.id}" not found.`);
        await db.update(deals).set({ archivedAt: now }).where(eq(deals.id, args.id));
        return kit.result(kit.deleted(args.id, "deal", `Deal "${existing.title}" archived.`));
      }
    }
  },
});
