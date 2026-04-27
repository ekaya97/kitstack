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
`;

export async function createTestDb() {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client);
  await client.executeMultiple(CREATE_TABLE_SQL);
  return db;
}
