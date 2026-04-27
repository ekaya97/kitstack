/**
 * kitstack serve — start a self-hosted MCP server.
 *
 * Reads kit.config.ts from the current directory (or --config path),
 * creates a local database, and starts an MCP server.
 *
 * Configuration via flags or env vars:
 *
 * | Flag / Env                | Default              | Description           |
 * |---------------------------|----------------------|-----------------------|
 * | --transport / KITSTACK_TRANSPORT | stdio          | stdio or http         |
 * | --port / KITSTACK_PORT    | 3001                 | HTTP port             |
 * | --db / KITSTACK_DB_URL    | file:.kitstack/dev.db| Database URL          |
 * | --db-token / KITSTACK_DB_TOKEN | (none)          | Database auth token   |
 * | --config                  | .                    | Path to kit root dir  |
 *
 * @example
 * ```bash
 * kitstack serve                          # stdio, local SQLite
 * kitstack serve --transport http         # HTTP on port 3001
 * KITSTACK_DB_URL=libsql://... kitstack serve --transport http
 * ```
 */

import { resolve } from "path";
import { existsSync } from "node:fs";

const SERVE_HELP = `
kitstack serve — start a self-hosted MCP server

Usage:
  kitstack serve [options]

Options:
  --transport <mode>  Transport: "stdio" or "http" (default: stdio, env: KITSTACK_TRANSPORT)
  --port <number>     HTTP port (default: 3001, env: KITSTACK_PORT)
  --db <url>          Database URL (default: file:.kitstack/dev.db, env: KITSTACK_DB_URL)
  --db-token <token>  Database auth token (env: KITSTACK_DB_TOKEN)
  --config <path>     Path to kit root directory (default: .)
  --help, -h          Show help
`.trim();

export async function serve(args: string[]) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(SERVE_HELP);
    process.exit(0);
  }

  // Parse flags
  let kitRoot = process.cwd();
  let transport = process.env.KITSTACK_TRANSPORT || "stdio";
  let port = parseInt(process.env.KITSTACK_PORT || "3001", 10);
  let dbUrl = process.env.KITSTACK_DB_URL || "file:.kitstack/dev.db";
  let dbToken = process.env.KITSTACK_DB_TOKEN;

  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const next = args[i + 1];
    switch (flag) {
      case "--config": kitRoot = resolve(next); i++; break;
      case "--transport": transport = next; i++; break;
      case "--port": port = parseInt(next, 10); i++; break;
      case "--db": dbUrl = next; i++; break;
      case "--db-token": dbToken = next; i++; break;
    }
  }

  // Load kit config
  const configPath = resolve(kitRoot, "kit.config.ts");
  if (!existsSync(configPath)) {
    console.error(`\n  No kit.config.ts found at ${kitRoot}\n`);
    process.exit(1);
  }

  const kitModule = await import(configPath);
  const kit = kitModule.default;

  if (!kit?.id || !kit?.tools) {
    console.error(`\n  Invalid kit.config.ts — must export a defineKit() result as default.\n`);
    process.exit(1);
  }

  // Run migrations if local SQLite
  if (dbUrl.startsWith("file:")) {
    const { createClient } = await import("@libsql/client");
    const client = createClient({ url: dbUrl });
    if (kit.migrationSql) {
      const statements = kit.migrationSql.split(";").filter((s: string) => s.trim());
      for (const sql of statements) {
        await client.execute(sql);
      }
    }
    client.close();
  }

  // Start server
  const { serve: startServer } = await import("../../server/index.js");
  await startServer({
    kit,
    db: { url: dbUrl, authToken: dbToken },
    transport: transport as "stdio" | "http",
    port,
  });
}
