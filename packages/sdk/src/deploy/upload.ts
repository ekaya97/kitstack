/**
 * Generic S3 upload for kit build artifacts.
 *
 * Reads from `.kitstack/build/` and uploads all artifacts to the KitAssets
 * S3 bucket, namespaced by kit ID to avoid conflicts between kits.
 *
 * Upload paths:
 * - View modules + CSS → `apps/kits/{kitId}/views/`
 * - Shell HTML → `apps/kits/{kitId}/shell.html`
 * - Server bundle (zip) → `bundles/{kitId}/kit.zip`
 * - Manifest → `bundles/{kitId}/manifest.json`
 *
 * All files use `Cache-Control: no-cache` during development.
 * Production deployments should use content-hash URLs or CloudFront invalidation.
 *
 * @module
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".zip": "application/zip",
};

/**
 * Options for {@link uploadKitBundle}.
 */
export interface UploadOptions {
  /** Absolute path to the kit's build directory (`.kitstack/build/`). */
  buildDir: string;
  /** Kit ID (used to namespace uploads). */
  kitId: string;
  /** S3 bucket name. */
  bucketName: string;
  /** Cache-Control header value. Default: no-cache (for dev). */
  cacheControl?: string;
}

/**
 * Upload a kit's build artifacts to S3.
 *
 * Uploads view modules, CSS, shell HTML, server bundle, and manifest.
 * Files are namespaced under the kit ID to prevent cross-kit conflicts.
 *
 * Requires `@aws-sdk/client-s3` to be available (lazy-loaded).
 *
 * @param options - Upload configuration
 * @returns Number of files uploaded
 *
 * @example
 * ```typescript
 * // In a deploy script
 * import { uploadKitBundle } from "@kitstack/sdk/deploy/upload";
 * import { Resource } from "sst";
 *
 * const count = await uploadKitBundle({
 *   buildDir: resolve(import.meta.dirname, ".kitstack/build"),
 *   kitId: "crm",
 *   bucketName: Resource.KitAssets.name,
 * });
 * console.log(`Uploaded ${count} files`);
 * ```
 */
export async function uploadKitBundle(options: UploadOptions): Promise<number> {
  const {
    buildDir,
    kitId,
    bucketName,
    cacheControl = "max-age=0, no-cache, no-store, must-revalidate",
  } = options;

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({});
  let count = 0;

  async function upload(filePath: string, s3Key: string): Promise<void> {
    const body = readFileSync(filePath);
    const ext = extname(filePath);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: body,
        ContentType: CONTENT_TYPES[ext] || "application/octet-stream",
        CacheControl: cacheControl,
      })
    );
    console.log(`  ✓ ${s3Key} (${(body.length / 1024).toFixed(1)} KB)`);
    count++;
  }

  async function uploadDir(dir: string, prefix: string): Promise<void> {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const entryPath = resolve(dir, entry);
      if (statSync(entryPath).isDirectory()) {
        await uploadDir(entryPath, `${prefix}/${entry}`);
      } else {
        await upload(entryPath, `${prefix}/${entry}`);
      }
    }
  }

  console.log(`Uploading kit "${kitId}" to ${bucketName}...\n`);

  // Views directory → apps/kits/{kitId}/
  // Uploads everything: per-view modules, vendor.js, shared.js, CSS.
  // vendor/shared have relative imports from per-view modules (../vendor.js)
  // so they must be at the same relative path as the build output.
  const viewsDir = resolve(buildDir, "views");
  if (existsSync(viewsDir)) {
    await uploadDir(viewsDir, `apps/kits/${kitId}`);
  }

  // Shell HTML
  const shellPath = resolve(buildDir, "shell.html");
  if (existsSync(shellPath)) {
    await upload(shellPath, `apps/kits/${kitId}/shell.html`);
  }

  // Server bundle (zip for Lambda)
  const zipPath = resolve(buildDir, "kit.zip");
  if (existsSync(zipPath)) {
    await upload(zipPath, `bundles/${kitId}/kit.zip`);
  }

  // Manifest
  const manifestPath = resolve(buildDir, "manifest.json");
  if (existsSync(manifestPath)) {
    await upload(manifestPath, `bundles/${kitId}/manifest.json`);
  }

  console.log(`\nDone. ${count} files uploaded.`);
  return count;
}
