/**
 * Shared kit runtime setup for CLI commands.
 *
 * Used by `kitstack call`, `kitstack serve`, and `kitstack dev --local`.
 * Loads a kit definition, provisions a database, runs migrations,
 * and creates a local adapter + protocol handler.
 */

import { resolve } from "path";
import { existsSync } from "node:fs";
import type { KitDefinition } from "../types";
import type { KitServerAdapter, ProtocolHandler } from "../server/types";

export interface LocalRuntimeOptions {
  /** Path to kit root directory. Default: process.cwd() */
  kitRoot?: string;
  /** Database URL. Default: "file:.kitstack/dev.db" */
  dbUrl?: string;
  /** Database auth token (for Turso). */
  dbToken?: string;
}

export interface LocalRuntime {
  kit: KitDefinition;
  protocol: ProtocolHandler;
  adapter: KitServerAdapter;
  cleanup: () => void;
}

/**
 * Create a local kit runtime: load kit, provision DB, create adapter + protocol handler.
 */
export async function createLocalRuntime(options: LocalRuntimeOptions = {}): Promise<LocalRuntime> {
  const kitRoot = options.kitRoot ?? process.cwd();
  const dbUrl = options.dbUrl ?? "file:.kitstack/dev.db";

  // Load kit config
  const configPath = resolve(kitRoot, "kit.config.ts");
  if (!existsSync(configPath)) {
    throw new Error(`No kit.config.ts found at ${kitRoot}`);
  }

  const kitModule = await import(configPath);
  const kit = kitModule.default ?? kitModule;

  if (!kit?.id || !kit?.tools) {
    throw new Error("Invalid kit.config.ts — must export a defineKit() result as default.");
  }

  // Create database client
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const client = createClient({ url: dbUrl, authToken: options.dbToken });

  // Run migrations (handles both migrationSql and migrationsDir)
  const { resolveMigrationSql } = await import("../migrations.js");
  const migrationSql = resolveMigrationSql(kit);
  if (migrationSql) {
    const statements = migrationSql.split(";").filter((s: string) => s.trim());
    for (const sql of statements) {
      // Add IF NOT EXISTS to CREATE TABLE/INDEX to make migrations idempotent
      const safe = sql
        .replace(/CREATE TABLE\b/gi, "CREATE TABLE IF NOT EXISTS")
        .replace(/CREATE INDEX\b/gi, "CREATE INDEX IF NOT EXISTS")
        .replace(/CREATE UNIQUE INDEX\b/gi, "CREATE UNIQUE INDEX IF NOT EXISTS");
      try {
        await client.execute(safe);
      } catch {
        // Skip statements that fail (e.g., already applied)
      }
    }
  }

  const db = drizzle(client);

  // Create adapter + protocol handler
  const { localAdapter } = await import("../server/adapters/local.js");
  const { createProtocolHandler } = await import("../server/protocol.js");

  const adapter = localAdapter({ kit, db });
  const protocol = createProtocolHandler({
    adapter,
    serverInfo: { name: kit.name, version: kit.version ?? "dev" },
  });

  return {
    kit,
    protocol,
    adapter,
    cleanup: () => client.close(),
  };
}
