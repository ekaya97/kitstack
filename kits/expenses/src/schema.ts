import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").default("EUR"),
  vatRate: integer("vat_rate"),
  netCents: integer("net_cents"),
  vatCents: integer("vat_cents"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  description: text("description").notNull(),
  vendor: text("vendor"),
  paymentMethod: text("payment_method"),
  isDeductible: integer("is_deductible").default(1),
  receiptNote: text("receipt_note"),
  tags: text("tags"),
  expenseDate: text("expense_date").notNull(),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_expenses_date").on(table.expenseDate),
  index("idx_expenses_category").on(table.category),
]);

export const income = sqliteTable("income", {
  id: text("id").primaryKey(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").default("EUR"),
  source: text("source").notNull(),
  description: text("description"),
  invoiceRef: text("invoice_ref"),
  paymentMethod: text("payment_method"),
  receivedDate: text("received_date").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_income_date").on(table.receivedDate),
]);

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  skr03Account: text("skr03_account"),
  parentCategory: text("parent_category"),
  isDefault: integer("is_default").default(0),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
