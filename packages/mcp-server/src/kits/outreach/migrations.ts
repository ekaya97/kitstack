export const migrationSql = `
CREATE TABLE IF NOT EXISTS sequences (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_persona TEXT,
  tone TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL REFERENCES sequences(id),
  position INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL REFERENCES sequences(id),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  linkedin_url TEXT,
  personalization_hooks TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER
);
`;
