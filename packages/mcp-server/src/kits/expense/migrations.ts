export const migrationSql = `
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_gross REAL NOT NULL,
  amount_net REAL,
  vat_amount REAL,
  vat_rate REAL,
  category TEXT,
  skr03_account TEXT,
  is_private INTEGER DEFAULT 0,
  needs_receipt INTEGER DEFAULT 1,
  notes TEXT,
  source TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS quarterly_summaries (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  total_gross REAL NOT NULL,
  total_net REAL NOT NULL,
  total_vat REAL NOT NULL,
  category_breakdown TEXT,
  flagged_items TEXT,
  generated_at INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;
