import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { eq, like, sql } from "drizzle-orm";
import { projects, timeEntries } from "../schema";

export const budgetStatus = defineTool({
  name: "budget_status",
  description: "Show budget vs. actual spending for a project. Warns at 80%+ utilization.",
  args: z.object({
    project: z.string().describe("Project name or ID"),
  }),
  handler: async (db, args) => {
    const [project] = args.project.startsWith("prj_")
      ? await db.select().from(projects).where(eq(projects.id, args.project))
      : await db.select().from(projects).where(like(projects.name, `%${args.project}%`)).limit(1);

    if (!project) return kit.notFound("project", args.project);
    if (project.budget === null || project.budget === undefined) return kit.text(`Project "${project.name}" has no budget set.`);

    const timeStats = await db.select({
      totalMinutes: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)`,
      billableMinutes: sql<number>`coalesce(sum(CASE WHEN ${timeEntries.billable} = 1 THEN ${timeEntries.durationMinutes} ELSE 0 END), 0)`,
    }).from(timeEntries).where(eq(timeEntries.projectId, project.id));

    const totalHours = (timeStats[0].totalMinutes / 60);
    const billableHours = (timeStats[0].billableMinutes / 60);

    const lines: string[] = [`## Budget Status — ${project.name}`];
    lines.push(`**Budget:** €${project.budget.toFixed(2)}`);
    lines.push(`**Billing type:** ${project.billingType ?? "not set"}`);

    if (project.billingType === "hourly" && project.hourlyRate) {
      const spent = billableHours * project.hourlyRate;
      const pct = Math.round((spent / project.budget) * 100);
      const remaining = project.budget - spent;
      const hoursRemaining = remaining / project.hourlyRate;

      lines.push(`**Hourly rate:** €${project.hourlyRate.toFixed(2)}/h`);
      lines.push(`**Billable hours:** ${billableHours.toFixed(1)}h`);
      lines.push(`**Spent:** €${spent.toFixed(2)} (${pct}%)`);
      lines.push(`**Remaining:** €${remaining.toFixed(2)} (~${hoursRemaining.toFixed(1)}h at current rate)`);

      if (pct >= 100) {
        lines.push("", "🚨 **Budget exceeded!** Consider discussing with the client.");
      } else if (pct >= 80) {
        lines.push("", "⚠️ **Approaching budget limit.** Review scope with client.");
      }
    } else {
      // Fixed / retainer / milestone — just show hours logged
      lines.push(`**Total hours logged:** ${totalHours.toFixed(1)}h (${billableHours.toFixed(1)}h billable)`);
      if (project.hourlyRate) {
        const impliedCost = billableHours * project.hourlyRate;
        const pct = Math.round((impliedCost / project.budget) * 100);
        lines.push(`**Implied cost at €${project.hourlyRate.toFixed(2)}/h:** €${impliedCost.toFixed(2)} (${pct}% of budget)`);
        if (pct >= 80) lines.push("", "⚠️ **Approaching budget based on implied hourly cost.**");
      }
    }

    return kit.text(lines.join("\n"));
  },
});
