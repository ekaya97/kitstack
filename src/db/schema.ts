import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// BetterAuth will auto-create its own tables (user, session, account, verification).
// Add your app-specific tables below.

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  platform: text("platform", { enum: ["claude", "chatgpt"] }).notNull(),
  category: text("category"),
  content: text("content"),
  s3Key: text("s3_key"),
  authorId: text("author_id"),
  likesCount: integer("likes_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  skillId: text("skill_id")
    .notNull()
    .references(() => skills.id),
  authorId: text("author_id"),
  authorName: text("author_name"),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const likes = sqliteTable("likes", {
  id: text("id").primaryKey(),
  skillId: text("skill_id")
    .notNull()
    .references(() => skills.id),
  userId: text("user_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const shortlists = sqliteTable("shortlists", {
  id: text("id").primaryKey(),
  skillId: text("skill_id")
    .notNull()
    .references(() => skills.id),
  userId: text("user_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
