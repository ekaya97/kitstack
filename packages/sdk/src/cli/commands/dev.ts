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
 * Loader data is delivered inline in the `kit_view` tool response (JSON
 * text block + HTML embedded resource), not via a separate `VIEW_DATA`
 * message. This was simplified from the original router design (T-0035)
 * to avoid a round-trip and keep the shell stateless.
 *
 * Build validation (T-0019) runs at `kitstack build` time, not in the dev
 * server. The dev command skips validation so iteration is fast; `build`
 * catches schema errors, missing View.tsx files, and invalid migration SQL
 * before deployment.
 *
 * @param args - CLI arguments after `kitstack dev` (e.g., `["--stdio"]`).
 *   Supported flags: `--stdio`, `--views`, `--port <n>`, `--config <path>`,
 *   `--db <path>`, `--reset-db`.
 *
 * @example Connect the CRM kit to Claude Desktop via stdio (real config from kits/crm):
 * ```json
 * {
 *   "mcpServers": {
 *     "crm": {
 *       "command": "npx",
 *       "args": ["tsx", "packages/sdk/src/cli/index.ts", "dev", "--stdio"],
 *       "cwd": "/path/to/kitstack/kits/crm"
 *     }
 *   }
 * }
 * ```
 *
 * @example Run the CRM kit locally with a fresh database on each restart:
 * ```sh
 * cd kits/crm
 * npx kitstack dev --stdio --reset-db
 * ```
 *
 * @example Point at a custom config and database (useful for integration tests):
 * ```sh
 * npx kitstack dev --stdio --config ./kits/crm/kit.config.ts --db ./tmp/test.db
 * ```
 *
 * @example Start the View DevKit for CRM view development with HMR:
 * ```sh
 * cd kits/crm
 * npx kitstack dev --views --port 5174
 * ```
 *
 * @remarks
 * The stdio transport reads one JSON-RPC message per line from stdin. It
 * relies on the LLM client (Claude Desktop, Claude Code) managing the
 * child process lifecycle: when the client closes stdin, the `readline`
 * `close` event fires and the process exits cleanly. There is no HTTP
 * server, no port binding, and no keep-alive — the process lifetime
 * matches the client session.
 *
 * Stderr is used for developer-facing log output (loading messages,
 * errors) and does not interfere with the JSON-RPC protocol on stdout.
 * Never write non-JSON to stdout in stdio mode or the client will reject
 * the response as a parse error.
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

  // Default mode is relay (no flags = relay mode)
  const relay = !stdio && !views;

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
  const { resolveMigrationSql } = await import("../../migrations.js");
  const migrationSql = resolveMigrationSql(kit);
  const fullDbPath = resolve(process.cwd(), dbPath);
  const db = await provisionDevDb(fullDbPath, migrationSql, { reset: resetDb });

  // Views mode — start DevKit HTTP server
  if (views) {
    const { startDevKitServer } = await import("../../devkit/server.js");
    await startDevKitServer({ kit, db, port: viewsPort });
    return;
  }

  // Create MCP handler
  const handler = createMcpHandler({ kit, db });

  // Relay mode — connect to DevRelay WebSocket
  if (relay) {
    const { loadCredentials } = await import("../credentials.js");
    const { connectRelay } = await import("../../runtime/relay-client.js");
    const { randomUUID } = await import("node:crypto");

    const creds = loadCredentials();
    if (!creds) {
      console.error("\n  Not logged in. Run: kitstack login\n");
      process.exit(1);
    }

    const sessionId = randomUUID().slice(0, 8);
    const relayUrl = process.env.KITSTACK_RELAY_URL || "wss://relay.kitstack.co";
    const publicUrl = `https://mcp.kitstack.co/dev/${sessionId}`;

    console.error(`\n  ${kit.name} dev server`);
    console.error(`  Connecting to relay...\n`);

    await connectRelay({
      sessionId,
      token: creds.token,
      handler,
      relayUrl,
      onReady: () => {
        console.error(`  Connected! Public URL:\n`);
        console.error(`  ${publicUrl}\n`);
        console.error(`  Add this URL to your LLM client's MCP server list.`);
        console.error(`  Press Ctrl+C to stop.\n`);
      },
      onDisconnect: () => {
        console.error("  Disconnected from relay. Reconnecting...");
      },
    });

    return;
  }

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
