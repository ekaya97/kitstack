import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { eq, and, like, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { projects, timeEntries } from "../schema";

function resolvePeriod(period: string): { start: string; end: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === "this_week") {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: fmt(monday), end: fmt(sunday), label: "This week" };
  }
  if (period === "last_week") {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: fmt(monday), end: fmt(sunday), label: "Last week" };
  }
  if (period === "this_month") {
    return { start: `${year}-${pad(month + 1)}-01`, end: fmt(now), label: "This month" };
  }
  if (period === "last_month") {
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    const lastDay = new Date(y, m, 0).getDate();
    return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${lastDay}`, label: "Last month" };
  }
  // default: this month
  return { start: `${year}-${pad(month + 1)}-01`, end: fmt(now), label: "This month" };
}

function fmt(d: Date) { return d.toISOString().split("T")[0]; }
function pad(n: number) { return n.toString().padStart(2, "0"); }

export const timeReport = defineTool({
  name: "time_report",
  description: "Time summary for a period, broken down by project with billable/unbillable split",
  args: z.object({
    project: z.string().describe("Filter by project name or ID").optional(),
    period: z.enum(["this_week", "last_week", "this_month", "last_month"])
      .describe("Time period (default: this_month)").optional().default("this_month"),
    billable_only: z.boolean().describe("Show only billable time").optional().default(false),
  }),
  handler: async (db, args) => {
    const { start, end, label } = resolvePeriod(args.period);
    const conditions: SQL[] = [
      sql`${timeEntries.entryDate} >= ${start}`,
      sql`${timeEntries.entryDate} <= ${end}`,
    ];

    if (args.project) {
      const [p] = args.project.startsWith("prj_")
        ? await db.select().from(projects).where(eq(projects.id, args.project))
        : await db.select().from(projects).where(like(projects.name, `%${args.project}%`)).limit(1);
      if (p) conditions.push(eq(timeEntries.projectId, p.id));
    }
    if (args.billable_only) conditions.push(eq(timeEntries.billable, 1));

    const rows = await db.select({
      projectName: projects.name,
      totalMinutes: sql<number>`sum(${timeEntries.durationMinutes})`,
      billableMinutes: sql<number>`sum(CASE WHEN ${timeEntries.billable} = 1 THEN ${timeEntries.durationMinutes} ELSE 0 END)`,
      unbillableMinutes: sql<number>`sum(CASE WHEN ${timeEntries.billable} = 0 THEN ${timeEntries.durationMinutes} ELSE 0 END)`,
      hourlyRate: projects.hourlyRate,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(timeEntries.projectId, projects.id))
    .where(and(...conditions))
    .groupBy(projects.name, projects.hourlyRate);

    if (rows.length === 0) return kit.text(`No time entries found for ${label} (${start} to ${end}).`);

    const lines: string[] = [`## Time Report — ${label}`, `${start} to ${end}`, ""];
    lines.push("| Project | Total | Billable | Unbillable | Rate |");
    lines.push("|---------|-------|----------|------------|------|");

    let grandTotal = 0, grandBillable = 0, grandValue = 0;
    for (const r of rows) {
      const total = (r.totalMinutes / 60).toFixed(1);
      const billable = (r.billableMinutes / 60).toFixed(1);
      const unbillable = (r.unbillableMinutes / 60).toFixed(1);
      const effectiveRate = r.hourlyRate ? `€${r.hourlyRate}/h` : "—";
      grandTotal += r.totalMinutes;
      grandBillable += r.billableMinutes;
      if (r.hourlyRate) grandValue += (r.billableMinutes / 60) * r.hourlyRate;
      lines.push(`| ${r.projectName} | ${total}h | ${billable}h | ${unbillable}h | ${effectiveRate} |`);
    }

    lines.push(`| **Total** | **${(grandTotal / 60).toFixed(1)}h** | **${(grandBillable / 60).toFixed(1)}h** | **${((grandTotal - grandBillable) / 60).toFixed(1)}h** | |`);
    if (grandValue > 0) {
      lines.push("", `**Billable value:** €${grandValue.toFixed(2)}`);
    }

    return kit.text(lines.join("\n"));
  },
});
