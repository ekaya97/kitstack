import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, like } from "drizzle-orm";
import { projects, milestones, tasks } from "../schema";

export const addTask = defineTool({
  name: "add_task",
  description: "Add a task to a project, optionally under a milestone",
  args: z.object({
    project: z.string().describe("Project name or ID"),
    title: z.string().describe("Task title"),
    description: z.string().describe("Task details").optional(),
    milestone: z.string().describe("Milestone name or ID to attach this task to").optional(),
    priority: z.enum(["low", "medium", "high", "urgent"])
      .describe("Priority level (default: medium)").optional().default("medium"),
    due_date: z.string().describe("Task deadline (YYYY-MM-DD)").optional(),
    estimated_hours: z.number().describe("Estimated hours to complete").optional(),
  }),
  handler: async (db, args) => {
    // Resolve project
    const [project] = args.project.startsWith("prj_")
      ? await db.select().from(projects).where(eq(projects.id, args.project))
      : await db.select().from(projects).where(like(projects.name, `%${args.project}%`)).limit(1);

    if (!project) return kit.notFound("project", args.project);

    // Resolve milestone if provided
    let milestoneId: string | null = null;
    if (args.milestone) {
      const [ms] = args.milestone.startsWith("mil_")
        ? await db.select().from(milestones).where(eq(milestones.id, args.milestone))
        : await db.select().from(milestones)
            .where(like(milestones.name, `%${args.milestone}%`))
            .limit(1);
      if (ms) milestoneId = ms.id;
    }

    const id = `tsk_${nanoid()}`;
    const now = new Date().toISOString();
    await db.insert(tasks).values({
      id,
      projectId: project.id,
      milestoneId,
      title: args.title,
      description: args.description ?? null,
      status: "todo",
      priority: args.priority,
      dueDate: args.due_date ?? null,
      estimatedHours: args.estimated_hours ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return kit.result(
      kit.created(id, "task", `Task "${args.title}" added to ${project.name}.`)
    );
  },
});
