import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { eq, like } from "drizzle-orm";
import { clients, projects, tasks } from "../schema";

export const archive = defineTool({
  name: "archive",
  description: "Soft-delete a project, client, or task. Archived items can be restored later.",
  args: z.object({
    entity_type: z.enum(["project", "client", "task"]).describe("What to archive"),
    name_or_id: z.string().describe("Name (fuzzy match) or ID of the entity"),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();
    const q = args.name_or_id;

    if (args.entity_type === "client") {
      const [row] = q.startsWith("cli_")
        ? await db.select().from(clients).where(eq(clients.id, q))
        : await db.select().from(clients).where(like(clients.name, `%${q}%`)).limit(1);
      if (!row) return kit.notFound("client", q);
      await db.update(clients).set({ archivedAt: now, updatedAt: now }).where(eq(clients.id, row.id));
      return kit.result(kit.deleted(row.id, "client", `Client "${row.name}" archived.`));
    }

    if (args.entity_type === "project") {
      const [row] = q.startsWith("prj_")
        ? await db.select().from(projects).where(eq(projects.id, q))
        : await db.select().from(projects).where(like(projects.name, `%${q}%`)).limit(1);
      if (!row) return kit.notFound("project", q);
      await db.update(projects).set({ archivedAt: now, updatedAt: now }).where(eq(projects.id, row.id));
      return kit.result(kit.deleted(row.id, "project", `Project "${row.name}" archived.`));
    }

    if (args.entity_type === "task") {
      const [row] = q.startsWith("tsk_")
        ? await db.select().from(tasks).where(eq(tasks.id, q))
        : await db.select().from(tasks).where(like(tasks.title, `%${q}%`)).limit(1);
      if (!row) return kit.notFound("task", q);
      // Tasks don't have archivedAt — mark as done with a note
      await db.update(tasks).set({ status: "done", completedDate: now.split("T")[0], updatedAt: now })
        .where(eq(tasks.id, row.id));
      return kit.result(kit.deleted(row.id, "task", `Task "${row.title}" archived.`));
    }

    return kit.error("Unknown entity type.");
  },
});
