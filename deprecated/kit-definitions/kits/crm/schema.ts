import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company"),
  email: text("email"),
  phone: text("phone"),
  source: text("source"),
  notes: text("notes"),
  lastContactedAt: text("last_contacted_at"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const deals = sqliteTable("deals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contactId: text("contact_id").references(() => contacts.id),
  value: real("value"),
  currency: text("currency").default("EUR"),
  stage: text("stage", {
    enum: ["prospect", "proposal", "negotiation", "won", "lost"],
  }).notNull().default("prospect"),
  notes: text("notes"),
  expectedCloseDate: text("expected_close_date"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  contactId: text("contact_id").references(() => contacts.id),
  dealId: text("deal_id").references(() => deals.id),
  type: text("type", {
    enum: ["call", "email", "meeting", "note", "task"],
  }).notNull(),
  description: text("description").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const proposals = sqliteTable("proposals", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").references(() => deals.id),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status", {
    enum: ["draft", "sent", "accepted", "rejected"],
  }).notNull().default("draft"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
