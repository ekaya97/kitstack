import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";

export async function createKitTestDb(migrationSql: string) {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client);

  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await db.run(sql.raw(stmt));
  }

  return db;
}
