import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { eq, like, desc, sql } from "drizzle-orm";
import { projects, clients, milestones, tasks, timeEntries } from "../schema";

export const projectOverview = defineTool({
  name: "project_overview",
  description: "Detailed view of a single project: milestones, tasks, time logged, and budget status",
  args: z.object({
    project: z.string().describe("Project name or ID"),
  }),
  load: async (db, args) => {
    const [project] = args.project.startsWith("prj_")
      ? await db.select().from(projects).where(eq(projects.id, args.project))
      : await db.select().from(projects).where(like(projects.name, `%${args.project}%`)).limit(1);

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
  },
  handler: async (db, args, ctx) => {
    const data = await projectOverview.load(db, args, ctx);
    if (!data) return kit.notFound("project", args.project);

    const p = data.project;
    const totalHours = (data.totalMinutes / 60).toFixed(1);
    const billableHours = (data.billableMinutes / 60).toFixed(1);
    const doneTasks = data.tasks.filter(t => t.status === "done").length;
    const totalTasks = data.tasks.length;

    const lines: string[] = [
      `## ${p.name}`,
      data.client ? `**Client:** ${data.client.name}` : null,
      `**Status:** ${p.status} | **Priority:** ${p.priority}`,
      p.startDate || p.dueDate ? `**Dates:** ${p.startDate ?? "—"} → ${p.dueDate ?? "—"}` : null,
      `**Tasks:** ${doneTasks}/${totalTasks} done`,
      `**Time logged:** ${totalHours}h (${billableHours}h billable)`,
    ].filter(Boolean) as string[];

    // Budget status
    if (p.budget !== null && p.budget !== undefined) {
      let spent = 0;
      if (p.billingType === "hourly" && p.hourlyRate) {
        spent = (data.billableMinutes / 60) * p.hourlyRate;
      }
      const pct = p.budget > 0 ? Math.round((spent / p.budget) * 100) : 0;
      lines.push(`**Budget:** €${spent.toFixed(2)} / €${p.budget.toFixed(2)} (${pct}%)${pct >= 80 ? " ⚠️" : ""}`);
    }

    // Milestones
    if (data.milestones.length > 0) {
      lines.push("", "### Milestones");
      for (const ms of data.milestones) {
        const icon = ms.status === "completed" ? "✅" : ms.status === "in_progress" ? "🔄" : "⬜";
        lines.push(`${icon} ${ms.name}${ms.dueDate ? ` (due ${ms.dueDate})` : ""}`);
      }
    }

    // Tasks by status
    if (data.tasks.length > 0) {
      lines.push("", "### Tasks");
      const statusOrder = ["in_progress", "todo", "blocked", "done"];
      for (const status of statusOrder) {
        const group = data.tasks.filter(t => t.status === status);
        if (group.length === 0) continue;
        lines.push(`\n**${status.replace("_", " ")}** (${group.length})`);
        for (const t of group.slice(0, 10)) {
          const prio = t.priority === "urgent" || t.priority === "high" ? ` [${t.priority}]` : "";
          lines.push(`- ${t.title}${prio}${t.dueDate ? ` (due ${t.dueDate})` : ""}`);
        }
        if (group.length > 10) lines.push(`- ... and ${group.length - 10} more`);
      }
    }

    return kit.text(lines.join("\n"));
  },
});
