/**
 * Upload platform-level view assets (vendor.js, shared.js) to S3.
 *
 * These are shared across ALL kits — cached once by the browser.
 * Run this once after building any kit (they all produce the same vendor/shared).
 *
 * Run: npx sst shell -- npx tsx scripts/upload-platform-assets.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";

const s3 = new S3Client({});
const BUCKET = (Resource as any).KitAssets.name;

async function uploadFile(filePath: string, s3Key: string) {
  const body = readFileSync(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: body,
      ContentType: s3Key.endsWith(".js") ? "application/javascript" : "text/html",
      CacheControl: "max-age=0, no-cache, no-store, must-revalidate",
    })
  );
  console.log(`  ✓ ${s3Key} (${(body.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  // Find vendor.js and shared.js from the most recently built kit
  const kitDirs = ["kits/crm", "kits/outreach", "kits/expense", "kits/meeting"];
  let viewsDir: string | null = null;

  for (const dir of kitDirs) {
    const candidate = resolve(dir, ".kitstack/build/views");
    if (existsSync(resolve(candidate, "vendor.js"))) {
      viewsDir = candidate;
      break;
    }
  }

  if (!viewsDir) {
    console.error("No built kit found. Run `kitstack build` on a kit first.");
    process.exit(1);
  }

  console.log(`Uploading platform assets to ${BUCKET}...\n`);

  await uploadFile(resolve(viewsDir, "vendor.js"), "apps/vendor.js");
  await uploadFile(resolve(viewsDir, "shared.js"), "apps/shared.js");

  // Also upload the universal app shell if it exists
  const shellPath = resolve(viewsDir, "../shell.html");
  if (existsSync(shellPath)) {
    await uploadFile(shellPath, "apps/app-shell.html");
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
