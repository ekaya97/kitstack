import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { eq, like, and } from "drizzle-orm";
import { tasks, milestones } from "../schema";

export const updateTask = defineTool({
  name: "update_task",
  description: "Update a task's status, priority, due date, or other details. Use this when the user says they finished, started, or changed a task.",
  args: z.object({
    task: z.string().describe("Task title (fuzzy match) or ID"),
    status: z.enum(["todo", "in_progress", "done", "blocked"])
      .describe("New status").optional(),
    priority: z.enum(["low", "medium", "high", "urgent"])
      .describe("New priority").optional(),
    title: z.string().describe("Updated title").optional(),
    description: z.string().describe("Updated description").optional(),
    due_date: z.string().describe("Updated deadline (YYYY-MM-DD)").optional(),
    estimated_hours: z.number().describe("Updated estimate in hours").optional(),
  }),
  handler: async (db, args) => {
    // Resolve task
    const [existing] = args.task.startsWith("tsk_")
      ? await db.select().from(tasks).where(eq(tasks.id, args.task))
      : await db.select().from(tasks).where(like(tasks.title, `%${args.task}%`)).limit(1);

    if (!existing) return kit.notFound("task", args.task);

    const now = new Date().toISOString();
    const updates: Record<string, any> = { updatedAt: now };
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "done") updates.completedDate = now.split("T")[0];
    }
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.due_date !== undefined) updates.dueDate = args.due_date;
    if (args.estimated_hours !== undefined) updates.estimatedHours = args.estimated_hours;

    await db.update(tasks).set(updates).where(eq(tasks.id, existing.id));

    // Check if all tasks in the milestone are done
    let hint = "";
    if (args.status === "done" && existing.milestoneId) {
      const remaining = await db.select().from(tasks)
        .where(and(
          eq(tasks.milestoneId, existing.milestoneId),
          like(tasks.status, "todo"),
        ));
      const inProgress = await db.select().from(tasks)
        .where(and(
          eq(tasks.milestoneId, existing.milestoneId),
          eq(tasks.status, "in_progress"),
        ));
      if (remaining.length === 0 && inProgress.length === 0) {
        const [ms] = await db.select().from(milestones)
          .where(eq(milestones.id, existing.milestoneId));
        if (ms && ms.status !== "completed") {
          hint = ` All tasks in milestone "${ms.name}" are done — consider completing it.`;
        }
      }
    }

    const changes: string[] = [];
    if (args.status !== undefined) changes.push(`status → ${args.status}`);
    if (args.priority !== undefined) changes.push(`priority → ${args.priority}`);
    if (args.title !== undefined) changes.push(`title → "${args.title}"`);
    if (args.due_date !== undefined) changes.push(`due date → ${args.due_date}`);

    const msg = changes.length > 0
      ? `Task "${existing.title}" updated: ${changes.join(", ")}.${hint}`
      : `Task "${existing.title}" updated.${hint}`;
    return kit.result(kit.updated(existing.id, "task", msg));
  },
});
