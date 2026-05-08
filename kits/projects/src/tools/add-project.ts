import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, like, isNull } from "drizzle-orm";
import { clients, projects } from "../schema";

export const addProject = defineTool({
  name: "add_project",
  description: "Create a new project, optionally linked to a client. If the client doesn't exist yet, it will be created automatically.",
  args: z.object({
    name: z.string().describe("Project name or title"),
    client: z.string().describe("Client name — matched by name, created if not found").optional(),
    description: z.string().describe("Brief project description").optional(),
    status: z.enum(["planning", "active", "paused", "completed", "cancelled"])
      .describe("Project status (default: active)").optional().default("active"),
    priority: z.enum(["low", "medium", "high", "urgent"])
      .describe("Priority level (default: medium)").optional().default("medium"),
    start_date: z.string().describe("Start date (YYYY-MM-DD)").optional(),
    due_date: z.string().describe("Due date / deadline (YYYY-MM-DD)").optional(),
    budget: z.number().describe("Total budget in EUR").optional(),
    hourly_rate: z.number().describe("Hourly rate in EUR (for hourly billing)").optional(),
    billing_type: z.enum(["hourly", "fixed", "retainer", "milestone"])
      .describe("How the project is billed").optional(),
    tags: z.string().describe("Comma-separated tags").optional(),
  }),
  handler: async (db, args) => {
    const now = new Date().toISOString();
    let clientId: string | null = null;

    if (args.client) {
      // Try to find existing client by name
      const [existing] = await db.select().from(clients)
        .where(like(clients.name, `%${args.client}%`))
        .limit(1);

      if (existing) {
        clientId = existing.id;
      } else {
        // Auto-create client
        clientId = `cli_${nanoid()}`;
        await db.insert(clients).values({
          id: clientId,
          name: args.client,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const id = `prj_${nanoid()}`;
    await db.insert(projects).values({
      id,
      clientId,
      name: args.name,
      description: args.description ?? null,
      status: args.status,
      priority: args.priority,
      startDate: args.start_date ?? null,
      dueDate: args.due_date ?? null,
      budget: args.budget ?? null,
      hourlyRate: args.hourly_rate ?? null,
      billingType: args.billing_type ?? null,
      currency: "EUR",
      tags: args.tags ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const msg = args.client
      ? `Project "${args.name}" created for ${args.client}.`
      : `Project "${args.name}" created.`;
    return kit.result(kit.created(id, "project", msg));
  },
});
