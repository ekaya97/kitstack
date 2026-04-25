/**
 * Submit a built kit to the KitStack marketplace.
 *
 * Runs the build pipeline if no build output exists, validates the
 * manifest, reads auth credentials, and uploads the bundle to the
 * KitStack API for review and deployment.
 *
 * @example
 * ```sh
 * cd kits/crm
 * npx kitstack publish
 * # ✓ Built "CRM Kit" (12 tools, 5 views)
 * # ✓ Uploaded bundle (283 KB) + manifest
 * # ✓ Submitted for review. Kit ID: crm, version: 1.0.0
 * ```
 */

import { resolve } from "node:path";
import { existsSync, readFileSync, createReadStream } from "node:fs";
import { loadCredentials } from "../credentials";
import { buildKit } from "../../build";

const KITSTACK_API_URL = process.env.KITSTACK_API_URL || "https://api.kitstack.co";

export async function publish(args: string[]) {
  const kitRoot = resolve(process.cwd());
  const buildDir = resolve(kitRoot, ".kitstack", "build");
  const manifestPath = resolve(buildDir, "manifest.json");

  // 1. Check auth
  const creds = loadCredentials();
  if (!creds) {
    console.error("\n  Not logged in. Run: kitstack login\n");
    process.exit(1);
  }

  // 2. Build if needed
  if (!existsSync(manifestPath)) {
    console.log("\n  No build output found. Building...\n");
    try {
      await buildKit(kitRoot);
    } catch (err: any) {
      console.error(`\n  Build failed: ${err.message}\n`);
      process.exit(1);
    }
  } else {
    console.log("\n  Using existing build output. Run `kitstack build` to rebuild.\n");
  }

  // 3. Read manifest
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  console.log(`  Kit: ${manifest.kitName} (${manifest.kitId} v${manifest.version})`);
  console.log(`  Tools: ${manifest.tools?.length ?? 0}, Views: ${manifest.views?.length ?? 0}`);

  // 4. Upload to KitStack API
  const serverBundlePath = resolve(buildDir, "kit.mjs");
  if (!existsSync(serverBundlePath)) {
    console.error("\n  Server bundle not found. Run: kitstack build\n");
    process.exit(1);
  }

  console.log(`\n  Uploading to KitStack...`);

  try {
    const bundleContent = readFileSync(serverBundlePath);
    const manifestContent = readFileSync(manifestPath, "utf-8");

    // Collect view files
    const viewsDir = resolve(buildDir, "views");
    const viewFiles: { name: string; content: Buffer }[] = [];
    if (existsSync(viewsDir)) {
      collectFiles(viewsDir, viewsDir, viewFiles);
    }

    const shellPath = resolve(buildDir, "shell.html");
    const shellContent = existsSync(shellPath) ? readFileSync(shellPath) : null;

    const payload = {
      manifest: JSON.parse(manifestContent),
      bundle: bundleContent.toString("base64"),
      shell: shellContent?.toString("base64") ?? null,
      views: viewFiles.map((f) => ({
        name: f.name,
        content: f.content.toString("base64"),
      })),
    };

    const response = await fetch(`${KITSTACK_API_URL}/kits/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n  Publish failed (${response.status}): ${errorText}\n`);
      process.exit(1);
    }

    const result = await response.json() as { status: string; kitId: string; version: string };

    console.log(`\n  ✓ Submitted for review.`);
    console.log(`    Kit ID: ${result.kitId}`);
    console.log(`    Version: ${result.version}`);
    console.log(`    Status: ${result.status}`);
    console.log(`\n  You'll be notified when the review is complete.\n`);
  } catch (err: any) {
    console.error(`\n  Publish failed: ${err.message}\n`);
    process.exit(1);
  }
}

function collectFiles(
  dir: string,
  baseDir: string,
  result: { name: string; content: Buffer }[]
): void {
  const { readdirSync, statSync } = require("node:fs");
  const { join, relative } = require("node:path");

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      collectFiles(fullPath, baseDir, result);
    } else {
      result.push({
        name: relative(baseDir, fullPath),
        content: readFileSync(fullPath),
      });
    }
  }
}
