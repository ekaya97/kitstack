export const migrationSql = `
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  attendees TEXT NOT NULL,
  raw_notes TEXT NOT NULL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id),
  description TEXT NOT NULL,
  owner TEXT,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id),
  description TEXT NOT NULL,
  created_at INTEGER
);
`;
