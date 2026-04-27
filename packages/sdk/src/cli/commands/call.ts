/**
 * kitstack call — execute kit tools from the command line.
 *
 * Positional arguments map to kit(id, cmd, params):
 *
 *   kitstack call kit                                     # list kits
 *   kitstack call kit crm                                 # list actions
 *   kitstack call kit crm add_contact '{"name":"Test"}'   # run action
 *   kitstack call kit_view crm                            # list views
 *   kitstack call kit_view crm contacts                   # render view
 *
 * If `kitstack dev --local` is running, routes through the live server.
 * Otherwise, creates an in-process runtime from kit.config.ts.
 *
 * @module
 */

import { resolve } from "path";
import { readFileSync, existsSync } from "node:fs";
import { createLocalRuntime } from "../kit-runtime";

const CALL_HELP = `
kitstack call — execute kit tools from the command line

Usage:
  kitstack call <tool> [id] [cmd] [params_json]

Examples:
  kitstack call kit                                     # list kits
  kitstack call kit crm                                 # list actions
  kitstack call kit crm add_contact '{"name":"Test"}'   # run action
  kitstack call kit_view crm                            # list views

Options:
  --config <path>     Path to kit root directory (default: .)
  --db <url>          Override database URL
  --help, -h          Show help
`.trim();

export async function call(args: string[]) {
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(CALL_HELP);
    process.exit(0);
  }

  // Parse flags
  let kitRoot = process.cwd();
  let dbUrl: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--config" && args[i + 1]) {
      kitRoot = resolve(args[++i]);
    } else if (flag === "--db" && args[i + 1]) {
      dbUrl = args[++i];
    } else if (!flag.startsWith("--")) {
      positional.push(flag);
    }
  }

  const tool = positional[0]; // "kit" or "kit_view"
  if (!tool || (tool !== "kit" && tool !== "kit_view")) {
    console.error(`Unknown tool: "${tool}". Use "kit" or "kit_view".`);
    process.exit(1);
  }

  // Build tool arguments
  const toolArgs: Record<string, unknown> = {};
  if (tool === "kit") {
    if (positional[1]) toolArgs.id = positional[1];
    if (positional[2]) toolArgs.cmd = positional[2];
    if (positional[3]) {
      try {
        toolArgs.params = JSON.parse(positional[3]);
      } catch {
        console.error("Invalid JSON for params argument.");
        process.exit(1);
      }
    }
  } else {
    // kit_view
    if (positional[1]) toolArgs.id = positional[1];
    if (positional[2]) toolArgs.view = positional[2];
  }

  // Build JSON-RPC request
  const request = {
    id: 1,
    method: "tools/call" as const,
    params: { name: tool, arguments: toolArgs },
  };

  // Try running dev server first
  const devServerResponse = await tryDevServer(kitRoot, request);
  if (devServerResponse !== null) {
    printResult(devServerResponse);
    return;
  }

  // Fall back to in-process runtime
  const runtime = await createLocalRuntime({ kitRoot, dbUrl });
  try {
    const response = await runtime.protocol.handleRequest(request, "dev-user");
    if (response) {
      printResult(response.result);
    }
  } finally {
    runtime.cleanup();
  }
}

/**
 * Check for a running `kitstack dev --local` server and route through it.
 * Returns the result if successful, null if no server is running.
 */
async function tryDevServer(
  kitRoot: string,
  request: Record<string, unknown>
): Promise<unknown | null> {
  const lockFile = resolve(kitRoot, ".kitstack/dev.json");
  if (!existsSync(lockFile)) return null;

  try {
    const lock = JSON.parse(readFileSync(lockFile, "utf-8"));
    const port = lock.port;
    if (!port) return null;

    const res = await fetch(`http://localhost:${port}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", ...request }),
    });

    if (!res.ok) return null;

    const json = await res.json();
    return json.result ?? null;
  } catch {
    // Server not reachable — fall back to in-process
    return null;
  }
}

function printResult(result: unknown) {
  if (!result) return;
  const r = result as any;
  const content = r.content ?? [];
  for (const block of content) {
    if (block.type === "text") {
      console.log(block.text);
    }
  }
}
