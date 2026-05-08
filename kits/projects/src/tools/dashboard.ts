import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { eq, and, isNull, lte, desc, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { projects, clients, tasks, timeEntries } from "../schema";

export const dashboard = defineTool({
  name: "dashboard",
  description: "Cross-project overview: active projects, overdue/urgent tasks, and time logged this week",
  args: z.object({}),
  load: async (db) => {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

    // Active projects with client names
    const activeProjects = await db.select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      priority: projects.priority,
      dueDate: projects.dueDate,
      clientName: clients.name,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(and(
      isNull(projects.archivedAt),
      eq(projects.status, "active"),
    ))
    .orderBy(projects.dueDate);

    // Task counts per project
    const taskCounts = await db.select({
      projectId: tasks.projectId,
      total: sql<number>`count(*)`,
      done: sql<number>`sum(CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END)`,
    })
    .from(tasks)
    .groupBy(tasks.projectId);

    // Urgent / overdue tasks
    const urgentTasks = await db.select({
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      projectName: projects.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(
      sql`${tasks.status} != 'done'`,
      sql`(${tasks.priority} IN ('urgent', 'high') OR ${tasks.dueDate} <= ${today})`,
    ))
    .orderBy(
      sql`CASE ${tasks.priority} WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END`,
      tasks.dueDate,
    )
    .limit(10);

    // Time logged this week per project
    const weeklyTime = await db.select({
      projectName: projects.name,
      totalMinutes: sql<number>`sum(${timeEntries.durationMinutes})`,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(timeEntries.projectId, projects.id))
    .where(sql`${timeEntries.entryDate} >= ${weekAgo}`)
    .groupBy(projects.name);

    return { activeProjects, taskCounts, urgentTasks, weeklyTime, today };
  },
  handler: async (db, args, ctx) => {
    const data = await dashboard.load(db, args, ctx);
    const lines: string[] = ["## Dashboard"];

    // Active projects
    lines.push("", "### Active Projects");
    if (data.activeProjects.length === 0) {
      lines.push("No active projects.");
    } else {
      for (const p of data.activeProjects) {
        const counts = data.taskCounts.find(tc => tc.projectId === p.id);
        const progress = counts ? `${counts.done}/${counts.total} tasks` : "no tasks";
        const overdue = p.dueDate && p.dueDate < data.today ? " ⚠️ OVERDUE" : "";
        lines.push(`- **${p.name}**${p.clientName ? ` (${p.clientName})` : ""} — ${progress}${p.dueDate ? `, due ${p.dueDate}` : ""}${overdue}`);
      }
    }

    // Urgent tasks
    if (data.urgentTasks.length > 0) {
      lines.push("", "### Needs Attention");
      for (const t of data.urgentTasks) {
        const overdue = t.dueDate && t.dueDate < data.today ? " OVERDUE" : "";
        lines.push(`- **${t.title}** (${t.projectName}) — ${t.priority}${overdue}`);
      }
    }

    // Weekly time
    if (data.weeklyTime.length > 0) {
      lines.push("", "### This Week");
      let totalWeek = 0;
      for (const w of data.weeklyTime) {
        const hours = (w.totalMinutes / 60).toFixed(1);
        totalWeek += w.totalMinutes;
        lines.push(`- ${w.projectName}: ${hours}h`);
      }
      lines.push(`- **Total:** ${(totalWeek / 60).toFixed(1)}h`);
    }

    return kit.text(lines.join("\n"));
  },
});
