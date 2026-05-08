import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const ideas = sqliteTable(
  "ideas",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    topic: text("topic"),
    targetChannel: text("target_channel"),
    inspiration: text("inspiration"),
    priority: text("priority").default("medium"),
    status: text("status").default("captured"),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_ideas_status").on(t.status), index("idx_ideas_topic").on(t.topic)]
);

export const content = sqliteTable(
  "content",
  {
    id: text("id").primaryKey(),
    ideaId: text("idea_id").references(() => ideas.id),
    title: text("title").notNull(),
    body: text("body"),
    channel: text("channel").notNull(),
    format: text("format"),
    status: text("status").default("draft"),
    scheduledDate: text("scheduled_date"),
    publishedDate: text("published_date"),
    publishedUrl: text("published_url"),
    notes: text("notes"),
    tags: text("tags"),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_content_channel").on(t.channel),
    index("idx_content_status").on(t.status),
    index("idx_content_published").on(t.publishedDate),
  ]
);

export const performance = sqliteTable(
  "performance",
  {
    id: text("id").primaryKey(),
    contentId: text("content_id")
      .notNull()
      .references(() => content.id),
    impressions: integer("impressions"),
    engagements: integer("engagements"),
    likes: integer("likes"),
    comments: integer("comments"),
    shares: integer("shares"),
    clicks: integer("clicks"),
    notes: text("notes"),
    recordedAt: text("recorded_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_performance_content").on(t.contentId)]
);

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  contentCount: integer("content_count").default(0),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull(),
});
