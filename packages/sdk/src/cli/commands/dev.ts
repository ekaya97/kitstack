import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { provisionDevDb } from "../../runtime/dev-db";
import { createMcpHandler, type JsonRpcRequest } from "../../runtime/mcp-handler";
import type { KitDefinition } from "../../types";

/**
 * Start the local development server for a kit.
 *
 * Loads the kit definition from `kit.config.ts`, provisions a local SQLite
 * database at `.kitstack/dev.db`, and serves MCP JSON-RPC requests. Two
 * transport modes are supported:
 *
 * - **`--stdio`** — reads newline-delimited JSON-RPC from stdin, writes
 *   responses to stdout. Zero-latency, no network. For Claude Desktop/Code.
 * - **`--views`** — starts the View DevKit HTTP server for local view
 *   development with HMR.
 *
 * The stdio transport handles the full MCP protocol: `initialize`,
 * `notifications/initialized`, `ping`, `tools/list`, and `tools/call`.
 * All kit tools are registered flat (no onion routing) plus a `kit_view`
 * tool if the kit declares views. Parse errors return JSON-RPC `-32700`,
 * notifications (requests without `id`) produce no response.
 *
 * @param args - CLI arguments after `kitstack dev` (e.g., `["--stdio"]`)
 *
 * @example Claude Desktop MCP config:
 * ```json
 * { "command": "npx", "args": ["kitstack", "dev", "--stdio"] }
 * ```
 *
 * @example Run from a kit directory with a fresh database:
 * ```sh
 * cd kits/crm
 * npx kitstack dev --stdio --reset-db
 * ```
 *
 * @example Custom config and database paths:
 * ```sh
 * npx kitstack dev --stdio --config ./my-kit.config.ts --db ./data/test.db
 * ```
 */
export async function dev(args: string[]) {
  // Parse flags
  let configPath = "kit.config.ts";
  let dbPath = ".kitstack/dev.db";
  let resetDb = false;
  let stdio = false;
  let views = false;
  let viewsPort = 5174;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--stdio":
        stdio = true;
        break;
      case "--views":
        views = true;
        break;
      case "--port":
        viewsPort = parseInt(args[++i], 10);
        break;
      case "--config":
        configPath = args[++i];
        break;
      case "--db":
        dbPath = args[++i];
        break;
      case "--reset-db":
        resetDb = true;
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!stdio && !views) {
    console.error("Specify a mode: --stdio (for Claude Desktop/Code) or --views (View DevKit).\nUsage: kitstack dev --stdio | kitstack dev --views");
    process.exit(1);
  }

  // Load kit definition
  const fullConfigPath = resolve(process.cwd(), configPath);
  let kit: KitDefinition;
  try {
    const mod = await import(fullConfigPath);
    kit = mod.default ?? mod;
  } catch (err: any) {
    console.error(`Failed to load kit config from ${configPath}: ${err.message}`);
    process.exit(1);
  }

  // Provision local SQLite
  const fullDbPath = resolve(process.cwd(), dbPath);
  const db = await provisionDevDb(fullDbPath, kit.migrationSql, { reset: resetDb });

  // Views mode — start DevKit HTTP server
  if (views) {
    const { startDevKitServer } = await import("../../devkit/server.js");
    await startDevKitServer({ kit, db, port: viewsPort });
    return;
  }

  // Create MCP handler
  const handler = createMcpHandler({ kit, db });

  // Stdio transport: newline-delimited JSON-RPC
  const rl = createInterface({ input: process.stdin });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(trimmed);
    } catch {
      const err = {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      };
      process.stdout.write(JSON.stringify(err) + "\n");
      return;
    }

    const response = await handler.handleRequest(request);

    // Notifications return null — don't send anything back
    if (response !== null) {
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}
