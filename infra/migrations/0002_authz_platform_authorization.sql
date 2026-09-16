-- Platform authorization storage and the one-time marketplace relation rename.
CREATE TABLE IF NOT EXISTS authz_memberships (
  id TEXT PRIMARY KEY NOT NULL,
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
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  mapping_type TEXT NOT NULL,
  claim_value TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS authz_identity_mappings_unique_idx
  ON authz_identity_mappings
    (provider, tenant_id, mapping_type, claim_value, subject_type, subject_id);
CREATE INDEX IF NOT EXISTS authz_identity_mappings_claim_idx
  ON authz_identity_mappings (provider, tenant_id, mapping_type, claim_value);

CREATE TABLE IF NOT EXISTS authz_version (
  id INTEGER PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL
);
INSERT OR IGNORE INTO authz_version (id, version) VALUES (1, 0);

UPDATE authz_tuples
SET relation = 'kit:use'
WHERE relation = 'activator';
