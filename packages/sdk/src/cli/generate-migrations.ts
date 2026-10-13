import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Generate SQL migrations from the kit's Drizzle schema with the kit's own
 * drizzle-kit. A no-op when the kit has no drizzle.config.ts or drizzle-kit
 * is not installed.
 *
 * drizzle-kit's output goes to stderr: in stdio mode stdout carries the MCP
 * JSON-RPC stream, and any other byte on it breaks the client connection.
 */
export function generateMigrations(kitRoot: string): void {
  if (!existsSync(resolve(kitRoot, "drizzle.config.ts"))) return;
  const bin = findBin(kitRoot, process.platform === "win32" ? "drizzle-kit.cmd" : "drizzle-kit");
  if (!bin) {
    console.error("[kitstack] drizzle-kit is not installed; using the existing migrations. Run `npm install -D drizzle-kit` to generate them from src/schema.ts.");
    return;
  }
  const result = spawnSync(bin, ["generate"], { cwd: kitRoot, stdio: ["ignore", "pipe", "pipe"], encoding: "utf-8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    console.error(`${output}\n[kitstack] drizzle-kit generate failed; using the existing migrations.`);
    return;
  }
  const created = output.match(/migrations\/[\w.-]+\.sql/);
  if (created) console.error(`[kitstack] New migration: ${created[0]}`);
}

/** The binary from the nearest node_modules/.bin, as npm workspaces may hoist it. */
function findBin(from: string, name: string): string | null {
  let dir = from;
  for (;;) {
    const candidate = resolve(dir, "node_modules", ".bin", name);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
