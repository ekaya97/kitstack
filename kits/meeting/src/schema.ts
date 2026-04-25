import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const meetings = sqliteTable("meetings", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  attendees: text("attendees", { mode: "json" }).$type<string[]>().notNull(),
  rawNotes: text("raw_notes").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const actionItems = sqliteTable("action_items", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id").notNull().references(() => meetings.id),
  description: text("description").notNull(),
  owner: text("owner"),
  deadline: text("deadline"),
  status: text("status", { enum: ["open", "done"] }).notNull().default("open"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id").notNull().references(() => meetings.id),
  description: text("description").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
