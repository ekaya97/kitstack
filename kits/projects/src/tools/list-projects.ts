import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { eq, like, and, isNull, desc, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { projects, clients, tasks } from "../schema";

export const listProjects = defineTool({
  name: "list_projects",
  description: "List projects with optional filters by status, client, or priority",
  args: z.object({
    status: z.enum(["planning", "active", "paused", "completed", "cancelled"])
      .describe("Filter by project status").optional(),
    client: z.string().describe("Filter by client name").optional(),
    priority: z.enum(["low", "medium", "high", "urgent"])
      .describe("Filter by priority").optional(),
    limit: z.number().describe("Max results (default: 25)").optional().default(25),
  }),
  handler: async (db, args) => {
    const conditions: SQL[] = [isNull(projects.archivedAt)];
    if (args.status) conditions.push(eq(projects.status, args.status));
    if (args.priority) conditions.push(eq(projects.priority, args.priority));

    if (args.client) {
      const [c] = await db.select().from(clients)
        .where(like(clients.name, `%${args.client}%`)).limit(1);
      if (c) conditions.push(eq(projects.clientId, c.id));
    }

    const rows = await db.select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      priority: projects.priority,
      dueDate: projects.dueDate,
      clientName: clients.name,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(desc(projects.updatedAt))
    .limit(args.limit);

    if (rows.length === 0) return kit.text("No projects found.");

    const lines = rows.map(r =>
      `| ${r.name} | ${r.clientName ?? "—"} | ${r.status} | ${r.priority} | ${r.dueDate ?? "—"} |`
    );
    return kit.text(
      `| Project | Client | Status | Priority | Due |\n|---------|--------|--------|----------|-----|\n${lines.join("\n")}\n\n${rows.length} project(s).`
    );
  },
});
