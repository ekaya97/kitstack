# Example: Building a Project Tracker Kit

## Phase 1: Requirements

**User:** "I need a kit to track my freelance projects, tasks, and time spent. I juggle 3-5 clients at once."

**Spec (approved):**

```
Kit ID: project-tracker
Name: Project Tracker
Description: Track freelance projects, tasks, time entries, and deadlines
Triggers: project, task, time, deadline, milestone, client

Entities:
1. projects (name, clientName, status, budgetAmount, deadline)
2. tasks (projectId→projects, title, status, priority, deadline)
3. time_entries (taskId→tasks, hours, date, notes)

Tools:
- add_project, list_projects, update_project
- add_task, list_tasks, update_task
- log_time, time_summary
- project_dashboard

Views (v1):
- dashboard — project stats, recent activity
```

## Phase 2: Schema

```ts
// src/schema.ts
import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  clientName: text("client_name"),
  status: text("status").default("active"),
  budgetAmount: real("budget_amount"),
  deadline: text("deadline"),
  notes: text("notes"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  status: text("status").default("todo"),
  priority: text("priority").default("medium"),
  deadline: text("deadline"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_tasks_project").on(table.projectId),
  index("idx_tasks_status").on(table.status),
]);

export const timeEntries = sqliteTable("time_entries", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  hours: real("hours").notNull(),
  date: text("date").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_time_task").on(table.taskId),
  index("idx_time_date").on(table.date),
]);

export const schema = { projects, tasks, timeEntries };
```

**Key decisions:**
- 3 entities with clear hierarchy: project → task → time_entry
- `status` as text with enums enforced in Zod (not DB) — more flexible
- `budgetAmount` as `real` (not cents) — KitStack convention
- Indexes on all foreign keys and frequently filtered columns

## Phase 3: Tools (abbreviated — showing key patterns)

### Build order: add_project → add_task → log_time → list tools → dashboard

**add_project** — Standard create with ID prefix `prj_`
**add_task** — Create with FK validation (check project exists)
**log_time** — Create with FK validation (check task exists)

```ts
// src/tools/log-time.ts
export const logTime = defineTool({
  name: "log_time",
  description: "Log time spent on a task",
  args: z.object({
    taskId: z.string().describe("Task ID from add_task or list_tasks"),
    hours: z.number().positive().describe("Hours spent (e.g., 2.5)"),
    date: z.string().optional().describe("Date in YYYY-MM-DD. Defaults to today."),
    notes: z.string().optional().describe("What you worked on"),
  }),
  handler: async (db, args) => {
    // Validate task exists
    const [task] = await db.select().from(tasks)
      .where(eq(tasks.id, args.taskId));
    if (!task) return kit.notFound("task", args.taskId);

    const id = `time_${nanoid()}`;
    const date = args.date ?? new Date().toISOString().slice(0, 10);

    await db.insert(timeEntries).values({
      id, taskId: args.taskId, hours: args.hours,
      date, notes: args.notes ?? null,
      createdAt: new Date().toISOString(),
    });

    return kit.result(
      kit.created(id, "time_entry",
        `Logged ${args.hours}h on "${task.title}" (${date}).`)
    );
  },
});
```

**project_dashboard** — Aggregate tool with `load` for view reuse:

```ts
export const projectDashboard = defineTool({
  name: "project_dashboard",
  description: "Show project overview with task progress and time spent",
  args: z.object({
    projectId: z.string().describe("Project ID"),
  }),
  load: async (db, args) => {
    const [project] = await db.select().from(projects)
      .where(eq(projects.id, args.projectId));
    if (!project) return null;

    const projectTasks = await db.select().from(tasks)
      .where(eq(tasks.projectId, args.projectId));

    const timeRows = await db
      .select({ total: sql<number>`sum(${timeEntries.hours})` })
      .from(timeEntries)
      .innerJoin(tasks, eq(timeEntries.taskId, tasks.id))
      .where(eq(tasks.projectId, args.projectId));

    return {
      project,
      tasks: projectTasks,
      totalHours: timeRows[0]?.total ?? 0,
      tasksByStatus: {
        todo: projectTasks.filter(t => t.status === "todo").length,
        inProgress: projectTasks.filter(t => t.status === "in-progress").length,
        done: projectTasks.filter(t => t.status === "done").length,
      },
    };
  },
  handler: async (db, args, ctx) => {
    const data = await projectDashboard.load(db, args, ctx);
    if (!data) return kit.notFound("project", args.projectId);

    const p = data.project;
    const budget = p.budgetAmount ? `€${p.budgetAmount.toLocaleString()}` : "No budget set";

    return kit.text([
      `## ${p.name}`,
      `**Client:** ${p.clientName ?? "—"} | **Status:** ${p.status} | **Budget:** ${budget}`,
      `**Deadline:** ${p.deadline ?? "None"}`,
      "",
      `### Tasks (${data.tasks.length} total)`,
      `- Todo: ${data.tasksByStatus.todo}`,
      `- In Progress: ${data.tasksByStatus.inProgress}`,
      `- Done: ${data.tasksByStatus.done}`,
      "",
      `### Time: ${data.totalHours.toFixed(1)} hours logged`,
    ].join("\n"));
  },
});
```

## Phase 4: Instructions

```ts
export const instructions = `## Project Tracker

You are a project management assistant for freelancers.

When the user mentions a new client project, suggest add_project.
When they mention tasks or to-dos, suggest add_task (ask which project).
When they mention working on something, suggest log_time.
When they ask "what should I work on?", show tasks by priority.

Project statuses: active, on-hold, completed.
Task priorities: high, medium, low. Task statuses: todo, in-progress, done.

Format time as "X.X hours". Currency as €X,XXX.XX.
Never show IDs — use project names and task titles.
When showing project summaries, include task progress and hours logged.
`;
```

## Phase 5: Dashboard View

```ts
// src/views/dashboard/index.ts
export default defineView({ slug: "dashboard", title: "Dashboard", loader });

// src/views/dashboard/loader.ts
export const loader = defineLoader(async (db) => {
  const activeProjects = await db.select().from(projects)
    .where(eq(projects.status, "active"));
  // ... aggregate stats
  return { projects: activeProjects, totalHours, taskStats };
});

// src/views/dashboard/View.tsx — React component with project cards
```

## Phase 6: Test & Deploy

```ts
// test/tools.test.ts
it("full workflow: project → task → time → dashboard", async () => {
  const p = await testKit.call("add_project", { name: "Acme Redesign", client_name: "Acme" });
  expect(p.isError).toBeUndefined();
  // Extract project ID, add task, log time, check dashboard...
});
```

```bash
npm test
# "test my kit" → run Tool Iterator
npx kitstack build
npx kitstack publish
```
