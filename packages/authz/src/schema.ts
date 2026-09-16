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

/** One-hop subject edges. A user may inherit a grant from a team or role. */
export const authzMemberships = sqliteTable("authz_memberships", {
  id: text("id").primaryKey(),
  memberType: text("member_type").notNull(),
  memberId: text("member_id").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("authz_memberships_unique_idx").on(
    table.memberType, table.memberId, table.subjectType, table.subjectId
  ),
  index("authz_memberships_member_idx").on(table.memberType, table.memberId),
  index("authz_memberships_subject_idx").on(table.subjectType, table.subjectId),
]);

/** Provider claim mappings resolved by the identity federation layer. */
export const authzIdentityMappings = sqliteTable("authz_identity_mappings", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  tenantId: text("tenant_id").notNull(),
  mappingType: text("mapping_type").notNull(),
  claimValue: text("claim_value").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
}, (table) => [
  uniqueIndex("authz_identity_mappings_unique_idx").on(
    table.provider,
    table.tenantId,
    table.mappingType,
    table.claimValue,
    table.subjectType,
    table.subjectId
  ),
  index("authz_identity_mappings_claim_idx").on(
    table.provider,
    table.tenantId,
    table.mappingType,
    table.claimValue
  ),
]);

/** Shared invalidation counter for all authz grants and subject edges. */
export const authzVersion = sqliteTable("authz_version", {
  id: integer("id").primaryKey(),
  version: integer("version").notNull(),
});
