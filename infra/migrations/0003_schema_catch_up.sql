-- Brings a database built from 0000-0002 up to web/src/db/schema.ts.
-- Production had picked these changes up through drizzle-kit push, so a fresh
-- database was missing them. No DROP: kit_registry still carries the NOT NULL
-- lambda_arn column from 0001, so the empty table is renamed out of the way
-- and rebuilt instead of being rebuilt in place.
ALTER TABLE kit_registry RENAME TO kit_registry_0001;

CREATE TABLE IF NOT EXISTS kit_registry (
  kit_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_description TEXT NOT NULL,
  input_schema TEXT NOT NULL,
  kit_name TEXT NOT NULL,
  kit_description TEXT,
  kit_triggers TEXT,
  kit_instructions TEXT,
  lambda_resource TEXT,
  visibility TEXT DEFAULT 'private' NOT NULL,
  author_id TEXT,
  migration_sql TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS kit_registry_kit_tool_idx ON kit_registry (kit_id, tool_name);

CREATE TABLE IF NOT EXISTS kit_views (
  kit_id TEXT NOT NULL,
  view_slug TEXT NOT NULL,
  view_name TEXT NOT NULL,
  view_description TEXT NOT NULL,
  height INTEGER DEFAULT 400,
  shell_s3_key TEXT,
  preview_s3_key TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS kit_views_pk ON kit_views (kit_id, view_slug);

ALTER TABLE skills ADD COLUMN featured INTEGER DEFAULT false;
ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'user' NOT NULL;
