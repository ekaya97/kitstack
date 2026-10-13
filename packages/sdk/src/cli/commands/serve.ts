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
 * | --mode / KITSTACK_SERVE_MODE | request             | request or daemon       |
 * | --port / KITSTACK_PORT    | 3001                 | HTTP port             |
 * | --path / KITSTACK_MCP_PATH | /mcp                | MCP endpoint path     |
 * | --db / KITSTACK_DB_URL    | file:.kitstack/dev.db| Database URL          |
 * | --db-token / KITSTACK_DB_TOKEN | (none)          | Database auth token   |
 * | --config                  | .                    | Path to kit root dir  |
 *
 * @module
 */

import { dirname, resolve } from "path";
import { createLocalRuntime, defaultDbUrl } from "../kit-runtime";

const SERVE_HELP = `
kitstack serve — start a self-hosted MCP server

Usage:
  kitstack serve [options]

Options:
  --transport <mode>  Transport: "stdio" or "http" (default: stdio, env: KITSTACK_TRANSPORT)
  --mode <mode>       Runtime mode: "request" or "daemon" (default: request, env: KITSTACK_SERVE_MODE)
  --port <number>     HTTP port (default: 3001, env: KITSTACK_PORT)
  --path <path>       HTTP path of the MCP endpoint (default: /mcp, env: KITSTACK_MCP_PATH)
  --db <url>          Database URL (default: file:.kitstack/dev.db, env: KITSTACK_DB_URL)
  --db-token <token>  Database auth token (env: KITSTACK_DB_TOKEN)
  --unsafe-skip-authz Run tools that declare authorize hooks without checking them (development only)
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
  let mode = process.env.KITSTACK_SERVE_MODE || "request";
  let port = parseInt(process.env.KITSTACK_PORT || "3001", 10);
  let mcpPath = process.env.KITSTACK_MCP_PATH || "/mcp";
  let dbUrl = process.env.KITSTACK_DB_URL;
  let dbToken = process.env.KITSTACK_DB_TOKEN;
  let authorization: "enforce" | "skip" = "enforce";

  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const next = args[i + 1];
    switch (flag) {
      case "--config": kitRoot = resolve(next).endsWith(".ts") ? dirname(resolve(next)) : resolve(next); i++; break;
      case "--transport": transport = next; i++; break;
      case "--mode": mode = next; i++; break;
      case "--port": port = parseInt(next, 10); i++; break;
      case "--path": mcpPath = next; i++; break;
      case "--db": dbUrl = next; i++; break;
      case "--db-token": dbToken = next; i++; break;
      case "--unsafe-skip-authz": authorization = "skip"; break;
    }
  }

  const { kit } = await createLocalRuntime({ kitRoot, dbUrl, dbToken, authorization });

  const { serve: startServer } = await import("../../server/index.js");
  await startServer({
    kit,
    db: { url: dbUrl ?? defaultDbUrl(kitRoot), authToken: dbToken },
    transport: transport as "stdio" | "http",
    mode: mode as "request" | "daemon",
    port,
    mcpPath,
    authorization,
  });
}
