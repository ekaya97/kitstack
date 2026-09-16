import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS authz_tuples (
    id TEXT PRIMARY KEY,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    relation TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    created_at INTEGER
  );
  CREATE UNIQUE INDEX IF NOT EXISTS authz_tuples_unique_idx
    ON authz_tuples (subject_type, subject_id, relation, object_type, object_id);
  CREATE INDEX IF NOT EXISTS authz_tuples_object_idx
    ON authz_tuples (object_type, object_id, relation);
  CREATE INDEX IF NOT EXISTS authz_tuples_subject_idx
    ON authz_tuples (subject_type, subject_id);
  CREATE TABLE IF NOT EXISTS authz_memberships (
    id TEXT PRIMARY KEY,
    member_type TEXT NOT NULL,
    member_id TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    created_at INTEGER
  );
  CREATE UNIQUE INDEX IF NOT EXISTS authz_memberships_unique_idx
    ON authz_memberships (member_type, member_id, subject_type, subject_id);
  CREATE INDEX IF NOT EXISTS authz_memberships_member_idx
    ON authz_memberships (member_type, member_id);
  CREATE INDEX IF NOT EXISTS authz_memberships_subject_idx
    ON authz_memberships (subject_type, subject_id);
  CREATE TABLE IF NOT EXISTS authz_identity_mappings (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    mapping_type TEXT NOT NULL,
    claim_value TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS authz_identity_mappings_unique_idx
    ON authz_identity_mappings (provider, tenant_id, mapping_type, claim_value, subject_type, subject_id);
  CREATE INDEX IF NOT EXISTS authz_identity_mappings_claim_idx
    ON authz_identity_mappings (provider, tenant_id, mapping_type, claim_value);
  CREATE TABLE IF NOT EXISTS authz_version (
    id INTEGER PRIMARY KEY,
    version INTEGER NOT NULL
  );
`;

export async function createTestDb() {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client);
  await client.executeMultiple(CREATE_TABLE_SQL);
  return db;
}
