import { defineLoader } from "@kitstackco/sdk";
import { eq, sql } from "drizzle-orm";
import { projects, timeEntries } from "../../schema";

export const loader = defineLoader(async (db) => {
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-01`;
  const today = now.toISOString().split("T")[0];

  // This month by project
  const monthlyByProject = await db.select({
    projectName: projects.name,
    totalMinutes: sql<number>`sum(${timeEntries.durationMinutes})`,
    billableMinutes: sql<number>`sum(CASE WHEN ${timeEntries.billable} = 1 THEN ${timeEntries.durationMinutes} ELSE 0 END)`,
    hourlyRate: projects.hourlyRate,
  })
  .from(timeEntries)
  .innerJoin(projects, eq(timeEntries.projectId, projects.id))
  .where(sql`${timeEntries.entryDate} >= ${monthStart}`)
  .groupBy(projects.name, projects.hourlyRate);

  // Daily breakdown for the past 7 days
  const dailyEntries = await db.select({
    entryDate: timeEntries.entryDate,
    projectName: projects.name,
    totalMinutes: sql<number>`sum(${timeEntries.durationMinutes})`,
  })
  .from(timeEntries)
  .innerJoin(projects, eq(timeEntries.projectId, projects.id))
  .where(sql`${timeEntries.entryDate} >= ${weekAgo}`)
  .groupBy(timeEntries.entryDate, projects.name)
  .orderBy(timeEntries.entryDate);

  // Return null when no time entries exist so devkit falls back to placeholder data
  if (monthlyByProject.length === 0) return null;

  return { monthlyByProject, dailyEntries, monthStart, today };
});
