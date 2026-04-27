import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { provisionDevDb } from "../../runtime/dev-db";
import { createMcpHandler, type JsonRpcRequest } from "../../runtime/mcp-handler";
import type { KitDefinition } from "../../types";

import { createDevLogger } from "../dev-logger.js";

/**
 * Start the local development server for a kit.
 *
 * Loads the kit definition from `kit.config.ts`, provisions a local SQLite
 * database at `.kitstack/dev.db`, and serves MCP JSON-RPC requests. Two
 * transport modes are supported:
 *
 * - **`--stdio`** — reads newline-delimited JSON-RPC from stdin, writes
 *   responses to stdout. Zero-latency, no network. For Claude Desktop/Code.
 * - **`--no-views`** — disables the View DevKit (Vite + preview UI).
 *   Use for kits without views or when you only care about tools.
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
 *   Supported flags: `--stdio`, `--no-views`, `--port <n>`, `--config <path>`,
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
 * @example Start relay mode without the View DevKit:
 * ```sh
 * cd kits/crm
 * npx kitstack dev --no-views
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
  let local = false;
  let noViews = false;
  let viewsPort = 5174;
  let localPort = 4567;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--stdio":
        stdio = true;
        break;
      case "--local":
        local = true;
        break;
      case "--no-views":
        noViews = true;
        break;
      case "--port":
        if (local) {
          localPort = parseInt(args[++i], 10);
        } else {
          viewsPort = parseInt(args[++i], 10);
        }
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
  const relay = !stdio && !local;

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

  // Generate migrations from Drizzle schema if drizzle.config.ts exists
  const kitDir = dirname(fullConfigPath);
  const drizzleConfigPath = resolve(kitDir, "drizzle.config.ts");
  if (existsSync(drizzleConfigPath) && !kit.migrationSql) {
    const { execSync } = await import("node:child_process");
    try {
      execSync("npx drizzle-kit generate", { cwd: kitDir, stdio: "inherit" });
    } catch {
      console.warn("[kitstack] Warning: drizzle-kit generate failed. Continuing with existing migrations.");
    }
  }

  // Provision local SQLite
  const { resolveMigrationSql } = await import("../../migrations.js");
  const migrationSql = resolveMigrationSql(kit);
  const fullDbPath = resolve(process.cwd(), dbPath);
  const db = await provisionDevDb(fullDbPath, migrationSql, { reset: resetDb });

  // Start View DevKit (Vite + preview UI) unless --no-views or no views
  let vitePort = 5175;
  if (kit.views?.length && !noViews) {
    const { startDevKitServer } = await import("../../devkit/server.js");
    const result = await startDevKitServer({ kit, db, port: viewsPort, kitRoot: kitDir });
    vitePort = result.vitePort;
  }

  // Dev logger with channel multiplexing
  const logger = createDevLogger();
  const uiUrl = (kit.views?.length && !noViews) ? `http://localhost:${viewsPort}` : undefined;
  logger.banner({
    name: kit.name,
    mode: local ? "local" : relay ? "relay" : "stdio",
    tools: kit.tools.length,
    views: kit.views?.length ?? 0,
    db: dbPath,
    uiUrl,
  });

  // Local HTTP mode — no relay, no stdio, just localhost
  if (local) {
    const { localAdapter } = await import("../../server/adapters/local.js");
    const { createProtocolHandler } = await import("../../server/protocol.js");

    const adapter = localAdapter({ kit, db });
    const protocol = createProtocolHandler({
      adapter,
      serverInfo: { name: kit.name, version: kit.version ?? "dev" },
    });

    // Write lock file so `kitstack call` can discover the running server
    const lockPath = resolve(process.cwd(), ".kitstack/dev.json");
    const { writeFileSync, mkdirSync, unlinkSync } = await import("node:fs");
    mkdirSync(resolve(process.cwd(), ".kitstack"), { recursive: true });
    writeFileSync(lockPath, JSON.stringify({ port: localPort, pid: process.pid }));

    const cleanup = () => {
      try { unlinkSync(lockPath); } catch {}
    };
    process.on("SIGINT", () => { cleanup(); process.exit(0); });
    process.on("SIGTERM", () => { cleanup(); process.exit(0); });
    process.on("exit", cleanup);

    // Start HTTP server
    const { createServer } = await import("node:http");
    const server = createServer(async (req, res) => {
      if (req.method !== "POST") {
        res.writeHead(405);
        res.end();
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();

      try {
        const request = JSON.parse(body);
        const start = Date.now();
        const response = await protocol.handleRequest(request, "dev-user");
        const ms = Date.now() - start;

        const method = request.method;
        if (method === "tools/call" && (request.params as any)?.name) {
          logger.tool((request.params as any).name, (request.params as any).arguments, ms);
        } else if (response) {
          logger.mcp(method, ms);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(response ? JSON.stringify(response) : "");
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
      }
    });

    server.listen(localPort, "127.0.0.1", () => {
      logger.status("connected", `http://localhost:${localPort}`);
      logger.info("Use `kitstack call` or point your MCP client here.");
      logger.info("Press Ctrl+C to stop.\n");
    });

    return;
  }

  // Relay mode — connect to DevRelay WebSocket
  if (relay) {
    const { loadCredentials } = await import("../credentials.js");
    const { connectRelay } = await import("../../runtime/relay-client.js");
    const { createHash } = await import("node:crypto");

    const creds = loadCredentials();
    if (!creds) {
      console.error("\n  Not logged in. Run: kitstack login\n");
      process.exit(1);
    }

    // Deterministic session ID from user — same URL every time
    const sessionId = createHash("sha256")
      .update(creds.email)
      .digest("hex")
      .slice(0, 8);
    const relayUrl = process.env.KITSTACK_RELAY_URL || "wss://relay.kitstack.co";
    const mcpBaseUrl = process.env.KITSTACK_MCP_URL || "https://mcp.kitstack.co";
    const publicUrl = `${mcpBaseUrl}/dev/${sessionId}`;

    // Create MCP handler — hybrid CDN + relay for view assets (T-0085):
    // vendor.js/shared.js load from CDN, per-view modules load through relay
    const platformCdn = process.env.KITSTACK_CDN || "";
    const kitCdnUrl = process.env.KITSTACK_KIT_CDN || "";
    const devAssetBaseUrl = `${mcpBaseUrl}/dev/${sessionId}`;
    const handler = createMcpHandler({
      kit, db, platformCdn, kitCdn: kitCdnUrl,
      devAssetBaseUrl,
    });

    logger.status("connecting");

    // CDN vendor URL — relay client redirects React imports here (T-0085)
    const cdnVendorUrl = platformCdn ? `${platformCdn}/vendor.js` : undefined;

    // Enable keyboard filter (m/t/s/a/?) before traffic starts
    logger.enableKeyFilter();

    await connectRelay({
      sessionId,
      token: creds.token,
      handler,
      relayUrl,
      vitePort,
      cdnVendorUrl,
      logger,
      onReady: () => {
        logger.status("connected", publicUrl);
        logger.info("Add this URL to your LLM client's MCP server list.");
        logger.info("Press Ctrl+C to stop.\n");
      },
      onDisconnect: () => {
        logger.status("disconnected");
      },
    });

    return;
  }

  // Stdio mode — create handler without dev asset URL
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
      logger.parseError();
      const err = {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      };
      process.stdout.write(JSON.stringify(err) + "\n");
      return;
    }

    const t0 = performance.now();
    const response = await handler.handleRequest(request);
    const ms = Math.round(performance.now() - t0);

    // Notifications return null — don't send anything back
    if (response !== null) {
      const method = request.method;
      const isError = "error" in response;
      if (isError) {
        const errMsg = (response as any).error?.message || "Error";
        logger.error(method, errMsg, ms);
      } else if (method === "tools/call" && (request.params as any)?.name) {
        logger.tool((request.params as any).name as string, (request.params as any).arguments, ms);
      } else {
        logger.mcp(method, ms);
      }
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}
