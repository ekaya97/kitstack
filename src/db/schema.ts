import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

// Skills: free downloadable .zip files
export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["Revenue", "Legal", "Finance", "Sales", "Marketing", "Operations"],
  }).notNull(),
  description: text("description").notNull(),
  upgradeHook: text("upgrade_hook"),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
  compatibility: text("compatibility", { mode: "json" }).$type<string[]>().notNull(),
  exampleInput: text("example_input").notNull(),
  exampleOutput: text("example_output").notNull(),
  whatsInside: text("whats_inside", { mode: "json" })
    .$type<{ file: string; description: string }[]>()
    .notNull(),
  composition: text("composition", { mode: "json" })
    .$type<{
      skillMd: boolean;
      references: number;
      examples: number;
      templates: number;
      scripts: number;
      agents: number;
    }>()
    .notNull(),
  s3Key: text("s3_key"),
  downloadCount: integer("download_count").default(0),
  // New fields
  author: text("author").default("kitstack"),
  fileSize: text("file_size"),
  correspondingKitSlug: text("corresponding_kit_slug"),
  avgRating: real("avg_rating").default(0),
  reviewCount: integer("review_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Kits: subscription apps with persistence
export const kits = sqliteTable("kits", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["Revenue", "Legal", "Finance", "Sales", "Marketing", "Operations"],
  }).notNull(),
  description: text("description").notNull(),
  correspondingSkillSlug: text("corresponding_skill_slug"),
  replaces: text("replaces").notNull(),
  savingsPerMonth: integer("savings_per_month").notNull(),
  dbSchema: text("db_schema"),
  mcpTools: text("mcp_tools", { mode: "json" })
    .$type<{ name: string; description: string }[]>(),
  mcpApps: text("mcp_apps", { mode: "json" })
    .$type<{ name: string; description: string }[]>(),
  // New fields
  tagline: text("tagline"),
  author: text("author").default("kitstack"),
  status: text("status", { enum: ["live", "coming_soon", "beta"] }).default("live"),
  subscriberCount: integer("subscriber_count").default(0),
  avgRating: real("avg_rating").default(0),
  reviewCount: integer("review_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Subscriptions
export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  plan: text("plan", { enum: ["starter", "pro"] }).notNull(),
  status: text("status", {
    enum: ["active", "cancelled", "expired"],
  }).notNull().default("active"),
  lemonSqueezySubscriptionId: text("lemonsqueezy_subscription_id"),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Reviews for skills and kits
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  targetType: text("target_type", { enum: ["skill", "kit"] }).notNull(),
  targetSlug: text("target_slug").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userRole: text("user_role"),
  rating: integer("rating").notNull(),
  text: text("text").notNull(),
  verified: integer("verified", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("reviews_user_target_idx").on(table.userId, table.targetType, table.targetSlug),
]);

// Helpful votes on reviews
export const reviewHelpful = sqliteTable("review_helpful", {
  id: text("id").primaryKey(),
  reviewId: text("review_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("review_helpful_unique_idx").on(table.reviewId, table.userId),
]);

// Wishlists
export const wishlists = sqliteTable("wishlists", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  targetType: text("target_type", { enum: ["skill", "kit"] }).notNull(),
  targetSlug: text("target_slug").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("wishlists_unique_idx").on(table.userId, table.targetType, table.targetSlug),
]);

// ── BetterAuth tables ──
export { user, session, account, verification } from "./auth-schema";

// Kit activations (tracks which kits a user has activated)
export const kitActivations = sqliteTable("kit_activations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  kitSlug: text("kit_slug").notNull(),
  status: text("status", { enum: ["active", "deactivated"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("kit_activations_unique_idx").on(table.userId, table.kitSlug),
]);

// Skill download history
export const skillDownloads = sqliteTable("skill_downloads", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  skillSlug: text("skill_slug").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type Kit = typeof kits.$inferSelect;
export type NewKit = typeof kits.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type Wishlist = typeof wishlists.$inferSelect;
export type SkillDownload = typeof skillDownloads.$inferSelect;
