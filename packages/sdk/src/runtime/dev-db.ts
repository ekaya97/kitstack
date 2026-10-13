import { existsSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { MigrationError } from "../errors";

/**
 * Provisions a local SQLite database for development.
 * Creates the directory structure if it does not exist, executes the
 * kit's migration SQL statements sequentially, and returns a ready-to-use
 * Drizzle ORM client backed by libSQL.
 *
 * Used by `kitstack dev` to create `.kitstack/dev.db` so developers can
 * run their kit locally without connecting to Turso or any remote database.
 *
 * **Behavior details:**
 * - Splits `migrationSql` on `;` and executes each non-empty statement in order.
 * - If `opts.reset` is `true` and the database file exists, it is deleted
 *   before provisioning (useful for wiping state during development).
 * - Parent directories are created recursively via `mkdirSync`.
 *
 * @param dbPath - Absolute or relative path to the SQLite file (e.g. `.kitstack/dev.db`).
 * @param migrationSql - Raw SQL string containing all CREATE TABLE / INSERT statements, separated by `;`.
 * @param opts - Optional settings.
 * @param opts.reset - When `true`, deletes the existing database file before re-provisioning.
 * @returns A Drizzle `LibSQLDatabase` instance connected to the local file.
 *
 * @throws {MigrationError} With code `MIGRATION_FAILED` if any SQL statement fails to execute.
 *
 * @example
 * ```typescript
 * import { provisionDevDb } from "@kitstack/sdk/runtime/dev-db";
 * import { migrationSql } from "./src/migrations";
 *
 * // First run: creates .kitstack/dev.db and runs migrations
 * const db = await provisionDevDb(".kitstack/dev.db", migrationSql);
 *
 * // Reset database on each restart during development
 * const db = await provisionDevDb(".kitstack/dev.db", migrationSql, { reset: true });
 * ```
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
    .filter((s) => s.length > 0);

  // Each statement runs once per database, so a later ALTER TABLE migration
  // does not fail on the next start. Databases created before this ledger
  // existed may already hold a statement's effect; that counts as applied.
  await client.execute("CREATE TABLE IF NOT EXISTS __kitstack_dev_migrations (hash TEXT PRIMARY KEY)");
  const applied = new Set(
    (await client.execute("SELECT hash FROM __kitstack_dev_migrations")).rows.map((row) => String(row.hash)),
  );

  for (const stmt of statements) {
    const hash = createHash("sha256").update(stmt).digest("hex");
    if (applied.has(hash)) continue;
    try {
      // Add IF NOT EXISTS to CREATE TABLE/INDEX statements for idempotency
      const safe = stmt
        .replace(/CREATE TABLE(?! IF NOT EXISTS)/gi, "CREATE TABLE IF NOT EXISTS")
        .replace(/CREATE INDEX(?! IF NOT EXISTS)/gi, "CREATE INDEX IF NOT EXISTS")
        .replace(/CREATE UNIQUE INDEX(?! IF NOT EXISTS)/gi, "CREATE UNIQUE INDEX IF NOT EXISTS");
      await client.execute(safe);
    } catch (err: any) {
      if (!/duplicate column|already exists/i.test(err.message ?? "")) {
        throw new MigrationError(
          "MIGRATION_FAILED",
          `Migration failed on statement: ${stmt.slice(0, 80)}... — ${err.message}`
        );
      }
    }
    await client.execute({ sql: "INSERT OR IGNORE INTO __kitstack_dev_migrations (hash) VALUES (?)", args: [hash] });
    applied.add(hash);
  }

  return db;
}
