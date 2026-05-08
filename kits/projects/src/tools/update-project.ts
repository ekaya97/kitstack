import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { eq, like } from "drizzle-orm";
import { projects } from "../schema";

export const updateProject = defineTool({
  name: "update_project",
  description: "Update a project's status, priority, dates, budget, or other details",
  args: z.object({
    project: z.string().describe("Project name or ID"),
    status: z.enum(["planning", "active", "paused", "completed", "cancelled"])
      .describe("New project status").optional(),
    priority: z.enum(["low", "medium", "high", "urgent"])
      .describe("New priority").optional(),
    name: z.string().describe("Updated project name").optional(),
    description: z.string().describe("Updated description").optional(),
    due_date: z.string().describe("Updated deadline (YYYY-MM-DD)").optional(),
    start_date: z.string().describe("Updated start date (YYYY-MM-DD)").optional(),
    budget: z.number().describe("Updated budget in EUR").optional(),
    hourly_rate: z.number().describe("Updated hourly rate in EUR").optional(),
    billing_type: z.enum(["hourly", "fixed", "retainer", "milestone"])
      .describe("Updated billing type").optional(),
    notes: z.string().describe("Updated notes").optional(),
    tags: z.string().describe("Updated comma-separated tags").optional(),
  }),
  handler: async (db, args) => {
    const [existing] = args.project.startsWith("prj_")
      ? await db.select().from(projects).where(eq(projects.id, args.project))
      : await db.select().from(projects).where(like(projects.name, `%${args.project}%`)).limit(1);

    if (!existing) return kit.notFound("project", args.project);

    const now = new Date().toISOString();
    const updates: Record<string, any> = { updatedAt: now };
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "completed") updates.completedDate = now.split("T")[0];
    }
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.due_date !== undefined) updates.dueDate = args.due_date;
    if (args.start_date !== undefined) updates.startDate = args.start_date;
    if (args.budget !== undefined) updates.budget = args.budget;
    if (args.hourly_rate !== undefined) updates.hourlyRate = args.hourly_rate;
    if (args.billing_type !== undefined) updates.billingType = args.billing_type;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.tags !== undefined) updates.tags = args.tags;

    await db.update(projects).set(updates).where(eq(projects.id, existing.id));

    const changes: string[] = [];
    if (args.status !== undefined) changes.push(`status → ${args.status}`);
    if (args.priority !== undefined) changes.push(`priority → ${args.priority}`);
    if (args.name !== undefined) changes.push(`name → "${args.name}"`);
    if (args.due_date !== undefined) changes.push(`due date → ${args.due_date}`);
    if (args.budget !== undefined) changes.push(`budget → €${args.budget}`);
    if (args.hourly_rate !== undefined) changes.push(`rate → €${args.hourly_rate}/h`);
    if (args.billing_type !== undefined) changes.push(`billing → ${args.billing_type}`);

    const msg = changes.length > 0
      ? `Project "${existing.name}" updated: ${changes.join(", ")}.`
      : `Project "${existing.name}" updated.`;
    return kit.result(kit.updated(existing.id, "project", msg));
  },
});
