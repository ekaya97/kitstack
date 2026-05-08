import { defineLoader } from "@kitstackco/sdk";
import { eq, sql } from "drizzle-orm";
import { projects, clients, milestones, tasks, timeEntries } from "../../schema";

export const loader = defineLoader(async (db, ctx) => {
  const projectId = ctx.params?.project;

  // If no project specified, return the first active project
  const [project] = projectId
    ? await db.select().from(projects).where(eq(projects.id, projectId))
    : await db.select().from(projects).where(eq(projects.status, "active")).limit(1);

  if (!project) return null;

  const client = project.clientId
    ? (await db.select().from(clients).where(eq(clients.id, project.clientId)))[0] ?? null
    : null;

  const projectMilestones = await db.select().from(milestones)
    .where(eq(milestones.projectId, project.id))
    .orderBy(milestones.sortOrder);

  const projectTasks = await db.select().from(tasks)
    .where(eq(tasks.projectId, project.id))
    .orderBy(tasks.sortOrder);

  const timeStats = await db.select({
    totalMinutes: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)`,
    billableMinutes: sql<number>`coalesce(sum(CASE WHEN ${timeEntries.billable} = 1 THEN ${timeEntries.durationMinutes} ELSE 0 END), 0)`,
  }).from(timeEntries).where(eq(timeEntries.projectId, project.id));

  return {
    project,
    client,
    milestones: projectMilestones,
    tasks: projectTasks,
    totalMinutes: timeStats[0]?.totalMinutes ?? 0,
    billableMinutes: timeStats[0]?.billableMinutes ?? 0,
  };
});
