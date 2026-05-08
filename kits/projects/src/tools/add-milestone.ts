import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, like } from "drizzle-orm";
import { projects, milestones } from "../schema";

export const addMilestone = defineTool({
  name: "add_milestone",
  description: "Add a milestone (deliverable or phase) to a project",
  args: z.object({
    project: z.string().describe("Project name or ID"),
    name: z.string().describe("Milestone name (e.g. 'Logo concepts', 'Phase 1 delivery')"),
    description: z.string().describe("Details about this milestone").optional(),
    due_date: z.string().describe("Milestone deadline (YYYY-MM-DD)").optional(),
  }),
  handler: async (db, args) => {
    // Resolve project by name or ID
    const [project] = args.project.startsWith("prj_")
      ? await db.select().from(projects).where(eq(projects.id, args.project))
      : await db.select().from(projects).where(like(projects.name, `%${args.project}%`)).limit(1);

    if (!project) return kit.notFound("project", args.project);

    const id = `mil_${nanoid()}`;
    const now = new Date().toISOString();
    await db.insert(milestones).values({
      id,
      projectId: project.id,
      name: args.name,
      description: args.description ?? null,
      dueDate: args.due_date ?? null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return kit.result(
      kit.created(id, "milestone", `Milestone "${args.name}" added to ${project.name}.`)
    );
  },
});
