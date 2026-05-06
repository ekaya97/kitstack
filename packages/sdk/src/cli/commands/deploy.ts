/**
 * Deploy a kit to the KitStack platform.
 *
 * Sends build artifacts to the KitStack API which handles S3 upload,
 * registry seeding, Lambda provisioning, and access grants.
 *
 * Requires `kitstack login` first.
 *
 * Run: npx kitstack deploy
 */
import { resolve } from "node:path";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { loadCredentials } from "../credentials";

const KITSTACK_API_URL = process.env.KITSTACK_API_URL || "https://kitstack.co";

const DEPLOY_HELP = `
kitstack deploy — deploy kit to KitStack platform (private)

Usage:
  kitstack deploy [options]

Options:
  --config <path>   Path to kit root directory (default: .)
  --help, -h        Show help

Requires: kitstack login
`.trim();

function collectFiles(dir: string, base: string): Array<{ name: string; content: string }> {
  if (!existsSync(dir)) return [];
  const files: Array<{ name: string; content: string }> = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectFiles(full, `${base}/${entry}`));
    } else {
      files.push({
        name: `${base}/${entry}`,
        content: readFileSync(full).toString("base64"),
      });
    }
  }
  return files;
}

export async function deploy(args: string[]) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(DEPLOY_HELP);
    process.exit(0);
  }

  // Parse flags
  let kitRoot = process.cwd();
  const configIdx = args.indexOf("--config");
  if (configIdx !== -1 && args[configIdx + 1]) {
    kitRoot = resolve(args[configIdx + 1]);
  }

  // Check credentials
  const creds = loadCredentials();
  if (!creds) {
    console.error("Not logged in. Run: kitstack login");
    process.exit(1);
  }

  // Check build output exists
  const buildDir = resolve(kitRoot, ".kitstack/build");
  const manifestPath = resolve(buildDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error(`No build output found at ${buildDir}. Run: kitstack build`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const kitId = manifest.kitId;

  console.log(`\nDeploying kit "${kitId}"...\n`);

  // Collect build artifacts
  const bundlePath = resolve(buildDir, "kit.zip");
  if (!existsSync(bundlePath)) {
    console.error("Server bundle (kit.zip) not found. Run: kitstack build");
    process.exit(1);
  }

  const payload: Record<string, unknown> = {
    manifest,
    bundle: readFileSync(bundlePath).toString("base64"),
  };

  // Shell HTML (for kits with views)
  const shellPath = resolve(buildDir, "shell.html");
  if (existsSync(shellPath)) {
    payload.shell = readFileSync(shellPath).toString("base64");
  }

  // View files
  const viewsDir = resolve(buildDir, "views");
  if (existsSync(viewsDir)) {
    payload.views = collectFiles(viewsDir, "");
  }

  // Preview files
  const previewsDir = resolve(buildDir, "previews");
  if (existsSync(previewsDir)) {
    const previews: Array<{ slug: string; content: string }> = [];
    for (const entry of readdirSync(previewsDir)) {
      if (entry.endsWith(".html")) {
        previews.push({
          slug: entry.replace(".html", ""),
          content: readFileSync(resolve(previewsDir, entry)).toString("base64"),
        });
      }
    }
    if (previews.length > 0) payload.previews = previews;
  }

  // Upload to KitStack API
  console.log("  Uploading to KitStack...\n");

  const response = await fetch(`${KITSTACK_API_URL}/api/cli/deploy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creds.token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage: string;
    try {
      errorMessage = JSON.parse(errorBody).error || errorBody;
    } catch {
      errorMessage = errorBody;
    }
    console.error(`  Deploy failed (${response.status}): ${errorMessage}\n`);
    process.exit(1);
  }

  const result = (await response.json()) as {
    kitId: string;
    kitSlug: string;
    tools: number;
    views: number;
    lambda: string | null;
  };

  console.log(`  ✓ Kit "${result.kitId}" deployed (private)`);
  console.log(`    Tools: ${result.tools}`);
  console.log(`    Views: ${result.views}`);
  if (result.lambda) console.log(`    Lambda: ${result.lambda}`);
  console.log(`\n  Activate it from your dashboard at ${KITSTACK_API_URL}/dashboard?tab=developer\n`);
  process.exit(0);
}
