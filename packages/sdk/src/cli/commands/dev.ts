import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
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

  // Views mode — start DevKit HTTP server
  if (views) {
    const { startDevKitServer } = await import("../../devkit/server.js");
    await startDevKitServer({ kit, db, port: viewsPort, kitRoot: kitDir });
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
    const devAssetBaseUrl = `${mcpBaseUrl}/dev/${sessionId}`;

    // Start local Vite dev server for view assets (if kit has views)
    let vitePort = 5175;
    if (kit.views?.length) {
      const { spawn } = await import("node:child_process");
      const { writeFileSync, mkdirSync } = await import("node:fs");
      const { relative } = await import("node:path");

      const entryDir = resolve(kitDir, ".kitstack/devkit-entries");
      mkdirSync(entryDir, { recursive: true });

      // Generate entry points per view
      for (const view of kit.views) {
        const viewFile = resolve(kitDir, "src/views", view.slug, "View.tsx");
        if (!existsSync(viewFile)) continue;
        const relPath = relative(entryDir, viewFile).replace(/\\/g, "/");
        const stylesFile = resolve(kitDir, "src/views/styles.css");
        const stylesImport = existsSync(stylesFile)
          ? `import "${relative(entryDir, stylesFile).replace(/\\/g, "/")}";\n` : "";
        writeFileSync(resolve(entryDir, `${view.slug}.tsx`), `${stylesImport}
import React from "react";
import { createRoot } from "react-dom/client";
import * as ViewModule from "${relPath}";
const Component = ViewModule.default || Object.values(ViewModule).find(v => typeof v === "function");
export function mount(container, data) {
  if (!Component) { container.innerHTML = "<p>No view component found</p>"; return; }
  createRoot(container).render(React.createElement(Component, { data }));
}
((window).__KITSTACK_VIEWS__ ??= {})["${kit.id}/${view.slug}"] = { mount };
`);
      }

      // Tailwind config with absolute paths
      const viewsGlob = resolve(kitDir, "src/views/**/*.tsx").replace(/\\/g, "/");
      writeFileSync(resolve(entryDir, "tailwind.config.cjs"), `
let typography; try { typography = require("@tailwindcss/typography"); } catch {}
module.exports = {
  content: ["${viewsGlob}"],
  theme: { extend: {
    colors: { "ks-paper":"#faf7f1","ks-paper-warm":"#f4ede0","ks-paper-deep":"#ece3d1","ks-ink":"#171512","ks-ink2":"#2a251f","ks-muted":"#6b6357","ks-faint":"#b8ae9b","ks-line":"#1a1814","ks-hair":"#d9ceb8","ks-accent":"#d65a2f","ks-accent-deep":"#a8411e","ks-accent-soft":"#f7d9c8","ks-hi":"#ffe45c" },
    fontFamily: { serif: ['"Instrument Serif"',"Georgia","serif"], sans: ['"Inter"',"system-ui","-apple-system","sans-serif"], mono: ['"JetBrains Mono"',"ui-monospace","monospace"] },
  }},
  plugins: typography ? [typography] : [],
};`);
      writeFileSync(resolve(entryDir, "postcss.config.cjs"), `
module.exports = { plugins: { tailwindcss: { config: "${resolve(entryDir, "tailwind.config.cjs").replace(/\\/g, "/")}" }, autoprefixer: {} } };
`);
      const projectRoot = resolve(kitDir, "../..");
      writeFileSync(resolve(entryDir, "vite.config.ts"), `
import { defineConfig } from "vite";
import { resolve } from "path";
export default defineConfig({
  root: "${kitDir.replace(/\\/g, "/")}",
  server: { port: ${vitePort}, strictPort: true, cors: true },
  esbuild: { jsx: "automatic" },
  css: { postcss: "${entryDir.replace(/\\/g, "/")}" },
  resolve: { dedupe: ["react","react-dom"], alias: { "react": resolve("${projectRoot.replace(/\\/g, "/")}", "node_modules/react"), "react-dom": resolve("${projectRoot.replace(/\\/g, "/")}", "node_modules/react-dom") } },
});`);
      writeFileSync(resolve(kitDir, "index.html"), `<!DOCTYPE html><html><head></head><body><div id="root"></div>${kit.views.map(v => `<script type="module" src="/.kitstack/devkit-entries/${v.slug}.tsx"></script>`).join("")}</body></html>`);

      // Start Vite
      const viteProcess = spawn("npx", ["vite", "--config", resolve(entryDir, "vite.config.ts")], {
        cwd: entryDir, stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, NODE_ENV: "development" },
      });
      viteProcess.stdout?.on("data", () => {});
      viteProcess.stderr?.on("data", () => {});
      process.on("exit", () => viteProcess.kill());
      process.on("SIGINT", () => { viteProcess.kill(); process.exit(0); });

      // Wait for Vite
      await new Promise<void>(r => { setTimeout(r, 3000); });
      console.error(`  Vite dev server running on port ${vitePort}`);
    }

    // Create MCP handler with dev asset URL
    const handler = createMcpHandler({
      kit, db,
      devAssetBaseUrl: kit.views?.length ? devAssetBaseUrl : undefined,
    });

    console.error(`\n  ${kit.name} dev server`);
    console.error(`  Connecting to relay...\n`);

    await connectRelay({
      sessionId,
      token: creds.token,
      handler,
      relayUrl,
      vitePort,
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
