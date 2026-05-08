import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { eq, like, and } from "drizzle-orm";
import { milestones, tasks, projects } from "../schema";

export const updateMilestone = defineTool({
  name: "update_milestone",
  description: "Update a milestone's status, name, due date, or description. Use this to mark a milestone as completed or in progress.",
  args: z.object({
    milestone: z.string().describe("Milestone name (fuzzy match) or ID"),
    status: z.enum(["pending", "in_progress", "completed"])
      .describe("New milestone status").optional(),
    name: z.string().describe("Updated milestone name").optional(),
    description: z.string().describe("Updated description").optional(),
    due_date: z.string().describe("Updated deadline (YYYY-MM-DD)").optional(),
  }),
  handler: async (db, args) => {
    const [existing] = args.milestone.startsWith("mil_")
      ? await db.select().from(milestones).where(eq(milestones.id, args.milestone))
      : await db.select().from(milestones).where(like(milestones.name, `%${args.milestone}%`)).limit(1);

    if (!existing) return kit.notFound("milestone", args.milestone);

    const now = new Date().toISOString();
    const updates: Record<string, any> = { updatedAt: now };
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "completed") updates.completedDate = now.split("T")[0];
    }
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.due_date !== undefined) updates.dueDate = args.due_date;

    await db.update(milestones).set(updates).where(eq(milestones.id, existing.id));

    const changes: string[] = [];
    if (args.status !== undefined) changes.push(`status → ${args.status}`);
    if (args.name !== undefined) changes.push(`name → "${args.name}"`);
    if (args.due_date !== undefined) changes.push(`due date → ${args.due_date}`);

    // If milestone completed, check if all milestones in the project are done
    let hint = "";
    if (args.status === "completed") {
      const remaining = await db.select().from(milestones)
        .where(and(
          eq(milestones.projectId, existing.projectId),
          like(milestones.status, "pending"),
        ));
      const inProgress = await db.select().from(milestones)
        .where(and(
          eq(milestones.projectId, existing.projectId),
          eq(milestones.status, "in_progress"),
        ));
      if (remaining.length === 0 && inProgress.length === 0) {
        const [project] = await db.select().from(projects)
          .where(eq(projects.id, existing.projectId));
        if (project && project.status !== "completed") {
          hint = ` All milestones in "${project.name}" are done — consider completing the project.`;
        }
      }
    }

    const msg = changes.length > 0
      ? `Milestone "${existing.name}" updated: ${changes.join(", ")}.${hint}`
      : `Milestone "${existing.name}" updated.${hint}`;
    return kit.result(kit.updated(existing.id, "milestone", msg));
  },
});
