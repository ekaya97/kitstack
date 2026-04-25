export const migrationSql = `
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,
  notes TEXT,
  last_contacted_at TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_id TEXT REFERENCES contacts(id),
  value REAL,
  currency TEXT DEFAULT 'EUR',
  stage TEXT NOT NULL DEFAULT 'prospect',
  notes TEXT,
  expected_close_date TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  contact_id TEXT REFERENCES contacts(id),
  deal_id TEXT REFERENCES deals(id),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  deal_id TEXT REFERENCES deals(id),
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER
);
`;
