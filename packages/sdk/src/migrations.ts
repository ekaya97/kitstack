/**
 * Resolves migration SQL from a KitDefinition.
 *
 * Supports two sources:
 * - `migrationSql` — raw SQL string (for Prisma users, hand-written SQL, etc.)
 * - `migrationsDir` — directory of numbered `.sql` files (drizzle-kit output)
 *
 * If both are provided, `migrationSql` takes precedence.
 * If neither is provided, returns an empty string (no migrations to run).
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Read all `.sql` files from a migrations directory in alphabetical order
 * and concatenate them into a single SQL string.
 */
export function readMigrationsDir(dir: string): string {
  if (!existsSync(dir)) return "";

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) return "";

  return files
    .map((f) => readFileSync(resolve(dir, f), "utf-8"))
    .join("\n");
}

/**
 * Resolve migration SQL from a kit definition's `migrationSql` or
 * `migrationsDir` fields. Returns the SQL string ready to be split
 * on `;` and executed statement-by-statement.
 */
export function resolveMigrationSql(opts: {
  migrationSql?: string;
  migrationsDir?: string;
}): string {
  if (opts.migrationSql) return opts.migrationSql;
  if (opts.migrationsDir) return readMigrationsDir(opts.migrationsDir);
  return "";
}
