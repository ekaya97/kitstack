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

    if (statSync(entryPath).isFile()) {
      await uploadFile(bucketName, entryPath, `${prefix}/${entry}`);
      count++;
    } else if (statSync(entryPath).isDirectory()) {
      count += await uploadDir(bucketName, entryPath, `${prefix}/${entry}`);
    }
  }

  return count;
}

async function upload() {
  const bucketName = (Resource as any).KitAssets.name;
  let count = 0;

  // Upload shell + inline HTML apps
  const inlineDir = resolve(process.cwd(), "packages/mcp-apps/dist-inline");
  if (existsSync(inlineDir)) {
    console.log("Uploading inline apps...");
    count += await uploadDir(bucketName, inlineDir, "apps");
  }

  // Upload chunked view modules (vendor.js, shared.js, per-view/*.js, style.css)
  const viewsDir = resolve(process.cwd(), "packages/mcp-apps/dist-views");
  if (existsSync(viewsDir)) {
    console.log("\nUploading view modules...");
    count += await uploadDir(bucketName, viewsDir, "apps");
  }

  console.log(`\nDone. ${count} files uploaded to ${bucketName}.`);
}

upload().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
