import { resolve } from "node:path";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { provisionDevDb } from "../../runtime/dev-db";
import { createMcpHandler, type JsonRpcRequest } from "../../runtime/mcp-handler";
import type { KitDefinition } from "../../types";

export async function dev(args: string[]) {
  // Parse flags
  let configPath = "kit.config.ts";
  let dbPath = ".kitstack/dev.db";
  let resetDb = false;
  let stdio = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--stdio":
        stdio = true;
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

  if (!stdio) {
    console.error("Only --stdio mode is supported currently. Usage: kitstack dev --stdio");
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
