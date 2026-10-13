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
import { generateMigrations } from "./generate-migrations";

/** The kit's local database, addressed absolutely so any working directory works. */
export function defaultDbUrl(kitRoot: string): string {
  return `file:${resolve(kitRoot, ".kitstack/dev.db")}`;
}

export interface LocalRuntimeOptions {
  /** Path to kit root directory. Default: process.cwd() */
  kitRoot?: string;
  /** Database URL. Default: "file:.kitstack/dev.db" */
  dbUrl?: string;
  /** Database auth token (for Turso). */
  dbToken?: string;
  /** "skip" runs `authorize`-guarded tools unchecked (local development only). */
  authorization?: "enforce" | "skip";
  /** Generate migrations from the Drizzle schema first (local development only). */
  generateMigrations?: boolean;
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
  const dbUrl = options.dbUrl ?? defaultDbUrl(kitRoot);

  // Load kit config
  const configPath = resolve(kitRoot, "kit.config.ts");
  if (!existsSync(configPath)) {
    throw new Error(`No kit.config.ts found at ${kitRoot}`);
  }

  const { tsImport } = await import("tsx/esm/api");
  const kitModule = await tsImport(configPath, import.meta.url);
  const kit = kitModule.default ?? kitModule;

  if (!kit?.id || !kit?.tools) {
    throw new Error("Invalid kit.config.ts — must export a defineKit() result as default.");
  }

  if (options.generateMigrations) generateMigrations(kitRoot);

  // Ensure DB directory exists for file: URLs
  if (dbUrl.startsWith("file:")) {
    const { mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    const dbPath = dbUrl.replace("file:", "");
    mkdirSync(dirname(resolve(kitRoot, dbPath)), { recursive: true });
  }

  // Create database client
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const client = createClient({ url: dbUrl, authToken: options.dbToken });

  // Run migrations (handles both migrationSql and migrationsDir)
  const { resolveMigrationSql, resolveMigrationsPath } = await import("../migrations.js");
  const resolvedKit = kit.migrationsDir
    ? { ...kit, migrationsDir: resolveMigrationsPath(kit.migrationsDir, kitRoot) }
    : kit;
  const migrationSql = resolveMigrationSql(resolvedKit);
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

  const authorization = options.authorization ?? "enforce";
  if (authorization === "skip") warnAuthorizationSkipped(kit);
  const adapter = localAdapter({ kit, db, authorization });
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

/** Make it visible when local tooling runs `authorize`-guarded tools unchecked. */
export function warnAuthorizationSkipped(kit: KitDefinition): void {
  const guarded = kit.tools.filter((tool) => typeof tool.authorize === "function").map((tool) => tool.name);
  if (guarded.length === 0) return;
  console.error(`[kitstack] Local development: authorize hooks are not enforced for ${guarded.join(", ")}. Self-hosted servers deny these tools unless checkAuthz is configured.`);
}
