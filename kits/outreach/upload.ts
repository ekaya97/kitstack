/**
 * Upload Outreach kit build artifacts to S3 KitAssets bucket.
 * Run from project root: npx sst shell -- npx tsx kits/outreach/upload.ts
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
      CacheControl: "max-age=0, no-cache, no-store, must-revalidate",
    })
  );
  console.log(`  ✓ ${s3Key} (${(body.length / 1024).toFixed(1)} KB)`);
}

async function uploadDir(bucketName: string, dir: string, prefix: string): Promise<number> {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const entryPath = resolve(dir, entry);
    if (statSync(entryPath).isDirectory()) {
      count += await uploadDir(bucketName, entryPath, `${prefix}/${entry}`);
    } else {
      await uploadFile(bucketName, entryPath, `${prefix}/${entry}`);
      count++;
    }
  }
  return count;
}

async function upload() {
  const bucketName = (Resource as any).KitAssets.name;
  const buildDir = resolve(import.meta.dirname, ".kitstack/build");
  const viewsDir = resolve(buildDir, "views");
  let count = 0;

  if (!existsSync(viewsDir)) {
    console.error("No build output found. Run the build first.");
    process.exit(1);
  }

  console.log("Uploading Outreach kit...\n");

  // Upload views directory recursively → apps/kits/cold-outreach/
  count += await uploadDir(bucketName, viewsDir, "apps/kits/cold-outreach");

  // Upload generated shell
  const shellPath = resolve(buildDir, "shell.html");
  if (existsSync(shellPath)) {
    await uploadFile(bucketName, shellPath, "apps/kits/cold-outreach/shell.html");
    count++;
  }

  console.log(`\nDone. ${count} files uploaded to ${bucketName}.`);
}

upload().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
