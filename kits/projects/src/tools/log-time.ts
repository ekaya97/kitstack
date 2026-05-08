import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, like } from "drizzle-orm";
import { projects, tasks, timeEntries } from "../schema";

export const logTime = defineTool({
  name: "log_time",
  description: "Log time worked on a project. Accepts hours (e.g. 2.5) or minutes (e.g. 90). If the user says 'spent 2 hours on X', log 120 minutes.",
  args: z.object({
    project: z.string().describe("Project name or ID"),
    duration_minutes: z.number().min(1).describe("Duration in minutes (convert hours to minutes: 2h = 120)"),
    task: z.string().describe("Task title or ID this time was spent on").optional(),
    description: z.string().describe("What was worked on").optional(),
    date: z.string().describe("Date of work (YYYY-MM-DD, defaults to today)").optional(),
    billable: z.boolean().describe("Whether this time is billable (default: true)").optional().default(true),
  }),
  handler: async (db, args) => {
    // Resolve project
    const [project] = args.project.startsWith("prj_")
      ? await db.select().from(projects).where(eq(projects.id, args.project))
      : await db.select().from(projects).where(like(projects.name, `%${args.project}%`)).limit(1);

    if (!project) return kit.notFound("project", args.project);

    // Resolve task if provided
    let taskId: string | null = null;
    if (args.task) {
      const [t] = args.task.startsWith("tsk_")
        ? await db.select().from(tasks).where(eq(tasks.id, args.task))
        : await db.select().from(tasks).where(like(tasks.title, `%${args.task}%`)).limit(1);
      if (t) taskId = t.id;
    }

    const id = `tim_${nanoid()}`;
    const entryDate = args.date ?? new Date().toISOString().split("T")[0];
    await db.insert(timeEntries).values({
      id,
      projectId: project.id,
      taskId,
      description: args.description ?? null,
      durationMinutes: args.duration_minutes,
      billable: args.billable ? 1 : 0,
      entryDate,
      createdAt: new Date().toISOString(),
    });

    const hours = (args.duration_minutes / 60).toFixed(1);
    return kit.result(
      kit.created(id, "time_entry", `Logged ${hours}h on ${project.name} (${entryDate}).`)
    );
  },
});
