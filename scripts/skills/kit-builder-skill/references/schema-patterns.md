# Schema Patterns

## Setup

Every kit defines its schema in `src/schema.ts` using Drizzle ORM for SQLite.

```ts
import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";
```

## Standard Column Patterns

### Primary Key (every table)
```ts
id: text("id").primaryKey(),
```
Generate with `nanoid()` in tool handlers. Never use auto-increment — IDs must be portable and predictable in tests.

Prefix IDs by entity type for debuggability:
```ts
const id = `con_${nanoid()}`; // contact
const id = `prj_${nanoid()}`; // project
const id = `exp_${nanoid()}`; // expense
```

### Timestamps (every table)
```ts
createdAt: text("created_at").notNull(),
updatedAt: text("updated_at").notNull(),
```
Store as ISO 8601 strings: `new Date().toISOString()`. SQLite doesn't have a native date type — text is the convention.

### Soft Delete
```ts
archivedAt: text("archived_at"),
```
Prefer soft delete over hard delete. Filter archived records in list queries with `isNull(table.archivedAt)`.

### Foreign Keys
```ts
contactId: text("contact_id").references(() => contacts.id),
companyId: text("company_id").references(() => companies.id),
```
Always add an index on foreign key columns:
```ts
}, (table) => [
  index("idx_deals_contact").on(table.contactId),
]);
```

## Field Type Guide

| Data | Drizzle Type | Example |
|------|-------------|---------|
| Short text (name, title) | `text("name").notNull()` | "Sarah Chen" |
| Long text (notes, description) | `text("notes")` | Nullable by default |
| Email, URL, phone | `text("email")` | Nullable, no format enforcement |
| Date | `text("date").notNull()` | "2026-05-08" (YYYY-MM-DD) |
| Datetime | `text("created_at").notNull()` | ISO 8601 full |
| Money amount | `real("amount").notNull()` | 42.50 (not cents) |
| Count, quantity | `integer("count")` | 5 |
| Boolean-like | `text("status")` | "active" / "archived" (prefer text enums) |
| Enum / status | `text("stage").default("lead")` | "lead", "won", "lost" |
| JSON data | `text("metadata")` | Stored as JSON string, parsed in handler |
| Tags | `text("tags")` | Comma-separated: "urgent,client-a" |

### Money Convention
Store monetary amounts as `real()` (floating point), **not** integer cents. This is the KitStack convention — it simplifies display and matches how users think about money.

```ts
// ✅ Correct
budgetAmount: real("budget_amount"),
// In handler: args.amount (e.g., 42.50)

// ❌ Wrong for KitStack
budgetCents: integer("budget_cents"),
// In handler: args.amount * 100 (unnecessary complexity)
```

## Common Schema Templates

### Contact / Person
```ts
export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  role: text("role"),
  source: text("source"), // how you met
  notes: text("notes"),
  tags: text("tags"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

### Item with Category
```ts
export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  category: text("category").notNull(), // enforce in Zod, not DB
  date: text("date").notNull(), // YYYY-MM-DD
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

### Parent-Child (e.g., project → task)
```ts
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  status: text("status").default("todo"),
  priority: text("priority").default("medium"),
  deadline: text("deadline"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_tasks_project").on(table.projectId),
  index("idx_tasks_status").on(table.status),
]);
```

### Settings / Key-Value
```ts
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```
Use for user preferences, configuration, and profile data that doesn't fit a fixed schema.

## Exporting the Schema

Always export a single `schema` object with all tables:

```ts
export const schema = { contacts, companies, deals, interactions };
```

This is passed to `defineKit({ schema })` and used by Drizzle for type inference.

## Migrations

After editing `src/schema.ts`:
```bash
npx kitstack dev  # auto-generates migrations via drizzle-kit
```

Migrations appear in `migrations/` as numbered SQL files. Commit them to git — they're a build input.

For raw SQL without Drizzle:
```ts
defineKit({
  migrationSql: `
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `,
});
```
