import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const authzTuples = sqliteTable("authz_tuples", {
  id: text("id").primaryKey(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  relation: text("relation").notNull(),
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("authz_tuples_unique_idx").on(
    table.subjectType, table.subjectId, table.relation, table.objectType, table.objectId
  ),
  index("authz_tuples_object_idx").on(table.objectType, table.objectId, table.relation),
  index("authz_tuples_subject_idx").on(table.subjectType, table.subjectId),
]);
