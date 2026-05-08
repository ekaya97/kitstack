import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { eq, like, and, lte, desc, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { tasks, projects } from "../schema";

export const listTasks = defineTool({
  name: "list_tasks",
  description: "List tasks across all projects or for a specific project. Great for answering 'what should I work on today?' or 'what's overdue?'",
  args: z.object({
    project: z.string().describe("Filter by project name or ID").optional(),
    status: z.enum(["todo", "in_progress", "done", "blocked"])
      .describe("Filter by task status").optional(),
    priority: z.enum(["low", "medium", "high", "urgent"])
      .describe("Filter by priority").optional(),
    due_before: z.string().describe("Show tasks due before this date (YYYY-MM-DD)").optional(),
    limit: z.number().describe("Max results (default: 25)").optional().default(25),
  }),
  handler: async (db, args) => {
    const conditions: SQL[] = [];

    if (args.project) {
      const [p] = args.project.startsWith("prj_")
        ? await db.select().from(projects).where(eq(projects.id, args.project))
        : await db.select().from(projects).where(like(projects.name, `%${args.project}%`)).limit(1);
      if (p) conditions.push(eq(tasks.projectId, p.id));
    }
    if (args.status) conditions.push(eq(tasks.status, args.status));
    if (args.priority) conditions.push(eq(tasks.priority, args.priority));
    if (args.due_before) conditions.push(lte(tasks.dueDate, args.due_before));

    const rows = await db.select({
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      projectName: projects.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      sql`CASE ${tasks.priority} WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END`,
      tasks.dueDate,
    )
    .limit(args.limit);

    if (rows.length === 0) return kit.text("No tasks found.");

    const lines = rows.map(r =>
      `| ${r.title} | ${r.projectName} | ${r.status} | ${r.priority} | ${r.dueDate ?? "—"} |`
    );
    return kit.text(
      `| Task | Project | Status | Priority | Due |\n|------|---------|--------|----------|-----|\n${lines.join("\n")}\n\n${rows.length} task(s).`
    );
  },
});
