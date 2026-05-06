import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain"),
  industry: text("industry"),
  size: text("size"),
  notes: text("notes"),
  tags: text("tags"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  companyId: text("company_id").references(() => companies.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  role: text("role"),
  relationship: text("relationship").default("neutral"),
  source: text("source"),
  notes: text("notes"),
  tags: text("tags"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_contacts_company").on(table.companyId),
]);

export const interactions = sqliteTable("interactions", {
  id: text("id").primaryKey(),
  contactId: text("contact_id").notNull().references(() => contacts.id),
  type: text("type").notNull(),
  summary: text("summary").notNull(),
  sentiment: text("sentiment"),
  followUp: text("follow_up"),
  followUpBy: text("follow_up_by"),
  occurredAt: text("occurred_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_interactions_contact").on(table.contactId),
]);

export const deals = sqliteTable("deals", {
  id: text("id").primaryKey(),
  contactId: text("contact_id").references(() => contacts.id),
  companyId: text("company_id").references(() => companies.id),
  title: text("title").notNull(),
  valueCents: integer("value_cents"),
  currency: text("currency").default("EUR"),
  stage: text("stage").default("lead"),
  probability: integer("probability"),
  expectedClose: text("expected_close"),
  lostReason: text("lost_reason"),
  notes: text("notes"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_deals_stage").on(table.stage),
  index("idx_deals_contact").on(table.contactId),
]);
