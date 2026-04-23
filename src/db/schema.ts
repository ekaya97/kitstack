import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Skills: free downloadable .zip files
export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["Revenue", "Legal", "Finance", "Sales", "Marketing", "Operations"],
  }).notNull(),
  description: text("description").notNull(),
  upgradeHook: text("upgrade_hook"), // why upgrade to the corresponding kit
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
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Kits: subscription MCP apps with persistence
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
  dbSchema: text("db_schema"), // SQL schema for display on detail page
  mcpTools: text("mcp_tools", { mode: "json" })
    .$type<{ name: string; description: string }[]>(),
  mcpApps: text("mcp_apps", { mode: "json" })
    .$type<{ name: string; description: string }[]>(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Subscriptions: placeholder for when payment is wired
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

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type Kit = typeof kits.$inferSelect;
export type NewKit = typeof kits.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
