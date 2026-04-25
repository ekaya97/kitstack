import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const sequences = sqliteTable("sequences", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  targetPersona: text("target_persona"),
  tone: text("tone"),
  status: text("status", {
    enum: ["draft", "active", "paused", "archived"],
  }).notNull().default("draft"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const emails = sqliteTable("emails", {
  id: text("id").primaryKey(),
  sequenceId: text("sequence_id").references(() => sequences.id).notNull(),
  position: integer("position").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  delayDays: integer("delay_days").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const prospects = sqliteTable("prospects", {
  id: text("id").primaryKey(),
  sequenceId: text("sequence_id").references(() => sequences.id).notNull(),
  name: text("name").notNull(),
  company: text("company"),
  email: text("email"),
  linkedinUrl: text("linkedin_url"),
  personalizationHooks: text("personalization_hooks"),
  status: text("status", {
    enum: ["pending", "contacted", "replied", "bounced", "opted_out"],
  }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
