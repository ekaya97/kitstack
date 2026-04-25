import { existsSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { MigrationError } from "../errors";

/**
 * Provisions a local SQLite database for development.
 * Creates the directory structure, runs migrations, and returns a Drizzle client.
 *
 * Used by `kitstack dev` to create `.kitstack/dev.db`.
 */
export async function provisionDevDb(
  dbPath: string,
  migrationSql: string,
  opts?: { reset?: boolean }
): Promise<LibSQLDatabase> {
  if (opts?.reset && existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  mkdirSync(dirname(dbPath), { recursive: true });

  const client = createClient({ url: `file:${dbPath}` });
  const db = drizzle(client);

  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
    } catch (err: any) {
      throw new MigrationError(
        "MIGRATION_FAILED",
        `Migration failed on statement: ${stmt.slice(0, 80)}... — ${err.message}`
      );
    }
  }

  return db;
}
