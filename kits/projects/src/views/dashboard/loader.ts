import { defineLoader } from "@kitstackco/sdk";
import { eq, and, isNull, sql } from "drizzle-orm";
import { projects, clients, tasks, timeEntries } from "../../schema";

export const loader = defineLoader(async (db) => {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const activeProjects = await db.select({
    id: projects.id,
    name: projects.name,
    status: projects.status,
    priority: projects.priority,
    dueDate: projects.dueDate,
    budget: projects.budget,
    hourlyRate: projects.hourlyRate,
    billingType: projects.billingType,
    clientName: clients.name,
  })
  .from(projects)
  .leftJoin(clients, eq(projects.clientId, clients.id))
  .where(and(isNull(projects.archivedAt), eq(projects.status, "active")))
  .orderBy(projects.dueDate);

  const taskCounts = await db.select({
    projectId: tasks.projectId,
    total: sql<number>`count(*)`,
    done: sql<number>`sum(CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END)`,
  })
  .from(tasks)
  .groupBy(tasks.projectId);

  const weeklyTime = await db.select({
    projectId: timeEntries.projectId,
    projectName: projects.name,
    totalMinutes: sql<number>`sum(${timeEntries.durationMinutes})`,
  })
  .from(timeEntries)
  .innerJoin(projects, eq(timeEntries.projectId, projects.id))
  .where(sql`${timeEntries.entryDate} >= ${weekAgo}`)
  .groupBy(timeEntries.projectId, projects.name);

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
  .orderBy(sql`CASE ${tasks.priority} WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END`, tasks.dueDate)
  .limit(8);

  // Return null when DB is empty so devkit falls back to placeholder data
  if (activeProjects.length === 0 && urgentTasks.length === 0) return null;

  return { activeProjects, taskCounts, weeklyTime, urgentTasks, today };
});
