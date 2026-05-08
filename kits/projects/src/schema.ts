import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  industry: text("industry"),
  notes: text("notes"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  clientId: text("client_id").references(() => clients.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active"),
  priority: text("priority").default("medium"),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  completedDate: text("completed_date"),
  budget: real("budget"),
  currency: text("currency").default("EUR"),
  hourlyRate: real("hourly_rate"),
  billingType: text("billing_type"),
  notes: text("notes"),
  tags: text("tags"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_projects_client").on(table.clientId),
  index("idx_projects_status").on(table.status),
]);

export const milestones = sqliteTable("milestones", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  completedDate: text("completed_date"),
  status: text("status").default("pending"),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_milestones_project").on(table.projectId),
]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  milestoneId: text("milestone_id").references(() => milestones.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("todo"),
  priority: text("priority").default("medium"),
  dueDate: text("due_date"),
  completedDate: text("completed_date"),
  estimatedHours: real("estimated_hours"),
  sortOrder: integer("sort_order").default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_tasks_project").on(table.projectId),
  index("idx_tasks_milestone").on(table.milestoneId),
  index("idx_tasks_status").on(table.status),
]);

export const timeEntries = sqliteTable("time_entries", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  taskId: text("task_id").references(() => tasks.id),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull(),
  billable: integer("billable").default(1),
  entryDate: text("entry_date").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_time_entries_project").on(table.projectId),
  index("idx_time_entries_date").on(table.entryDate),
]);

export const schema = { clients, projects, milestones, tasks, timeEntries };
