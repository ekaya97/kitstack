import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { Resource } from "sst";

const s3 = new S3Client({});
const distDir = resolve(process.cwd(), "packages/mcp-apps/dist-inline");

async function uploadFile(bucketName: string, filePath: string, s3Key: string) {
  const body = readFileSync(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: body,
      ContentType: "text/html",
    })
  );
  console.log(`  ✓ ${s3Key} (${(body.length / 1024).toFixed(1)} KB)`);
}

async function upload() {
  const bucketName = (Resource as any).KitAssets.name;
  let count = 0;

  for (const entry of readdirSync(distDir)) {
    const entryPath = resolve(distDir, entry);

    // Flat HTML files (e.g., app-shell.html)
    if (entry.endsWith(".html") && statSync(entryPath).isFile()) {
      await uploadFile(bucketName, entryPath, `apps/${entry}`);
      count++;
      continue;
    }

    // Kit subdirectories
    if (statSync(entryPath).isDirectory()) {
      for (const file of readdirSync(entryPath)) {
        if (!file.endsWith(".html")) continue;
        await uploadFile(bucketName, resolve(entryPath, file), `apps/${entry}/${file}`);
        count++;
      }
    }
  }

  console.log(`\nDone. ${count} app files uploaded to ${bucketName}.`);
}

upload().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
