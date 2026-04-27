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
 * @module
 */

import { resolve } from "path";
import { createLocalRuntime } from "../kit-runtime";

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

  let kitRoot = process.cwd();
  let transport = process.env.KITSTACK_TRANSPORT || "stdio";
  let port = parseInt(process.env.KITSTACK_PORT || "3001", 10);
  let dbUrl = process.env.KITSTACK_DB_URL;
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

  const { kit, protocol } = await createLocalRuntime({ kitRoot, dbUrl, dbToken });

  const { serve: startServer } = await import("../../server/index.js");
  await startServer({
    kit,
    db: { url: dbUrl ?? "file:.kitstack/dev.db", authToken: dbToken },
    transport: transport as "stdio" | "http",
    port,
  });
}
