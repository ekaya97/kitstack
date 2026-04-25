/**
 * Upload CRM kit view modules + CSS to S3 KitAssets bucket.
 * Run from project root: npx sst shell -- npx tsx packages/kits/crm/upload.ts
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { Resource } from "sst";

const s3 = new S3Client({});

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
};

async function uploadFile(bucketName: string, filePath: string, s3Key: string) {
  const body = readFileSync(filePath);
  const ext = extname(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: body,
      ContentType: CONTENT_TYPES[ext] || "application/octet-stream",
      CacheControl: "no-cache",
    })
  );
  console.log(`  ✓ ${s3Key} (${(body.length / 1024).toFixed(1)} KB)`);
}

async function upload() {
  const bucketName = (Resource as any).KitAssets.name;
  const buildDir = resolve(process.cwd(), "packages/kits/crm/.kitstack/build");
  const viewsDir = resolve(buildDir, "views");
  let count = 0;

  if (!existsSync(viewsDir)) {
    console.error("No build output found. Run the build first: cd packages/kits/crm && npx tsx build.ts");
    process.exit(1);
  }

  console.log("Uploading CRM kit view modules...\n");

  // Upload view JS modules → apps/crm/{view}.js (same paths as existing first-party views)
  for (const entry of readdirSync(viewsDir)) {
    const entryPath = resolve(viewsDir, entry);
    if (!statSync(entryPath).isFile()) continue;

    if (entry.endsWith(".js")) {
      // View modules go under apps/crm/
      await uploadFile(bucketName, entryPath, `apps/crm/${entry}`);
      count++;
    } else if (entry === "style.css") {
      // Kit CSS — for now upload alongside the platform style.css as crm-style.css
      // The existing shell loads apps/style.css (platform). This is for future use.
      await uploadFile(bucketName, entryPath, `apps/crm/style.css`);
      count++;
    }
  }

  // Upload generated shell (for future use — not active yet)
  const shellPath = resolve(buildDir, "shell.html");
  if (existsSync(shellPath)) {
    await uploadFile(bucketName, shellPath, `apps/crm/shell.html`);
    count++;
  }

  console.log(`\nDone. ${count} files uploaded to ${bucketName}.`);
}

upload().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
