import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  amountGross: real("amount_gross").notNull(),
  amountNet: real("amount_net"),
  vatAmount: real("vat_amount"),
  vatRate: real("vat_rate"),
  category: text("category"),
  skr03Account: text("skr03_account"),
  isPrivate: integer("is_private", { mode: "boolean" }).default(false),
  needsReceipt: integer("needs_receipt", { mode: "boolean" }).default(true),
  notes: text("notes"),
  source: text("source"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const quarterlySummaries = sqliteTable("quarterly_summaries", {
  id: text("id").primaryKey(),
  year: integer("year").notNull(),
  quarter: integer("quarter").notNull(),
  totalGross: real("total_gross").notNull(),
  totalNet: real("total_net").notNull(),
  totalVat: real("total_vat").notNull(),
  categoryBreakdown: text("category_breakdown", { mode: "json" }).$type<Record<string, number>>(),
  flaggedItems: text("flagged_items", { mode: "json" }).$type<string[]>(),
  generatedAt: integer("generated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});
