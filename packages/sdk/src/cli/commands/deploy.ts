/**
 * Deploy a kit to the KitStack platform.
 *
 * Uploads build artifacts to S3, seeds the kit registry, provisions a
 * Lambda, and grants the deployer access. The kit is private by default —
 * only the deployer (and invited collaborators) can use it.
 *
 * Requires `kitstack login` first (needs credentials for authz tuple).
 * Requires SST shell context (needs Resource bindings for S3, Turso, Lambda).
 *
 * Run: npx sst shell -- npx kitstack deploy
 */
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadCredentials } from "../credentials";
import type { KitManifest } from "../../deploy/seed-registry";

const DEPLOY_HELP = `
kitstack deploy — deploy kit to KitStack platform (private by default)

Usage:
  kitstack deploy [options]

Options:
  --config <path>   Path to kit root directory (default: .)
  --public          Make the kit visible on the marketplace
  --help, -h        Show help

Requires: kitstack login, npx sst shell context
`.trim();

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

  const isPublic = args.includes("--public");

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

  const manifest: KitManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const kitId = manifest.kitId;

  console.log(`\nDeploying kit "${kitId}"...\n`);

  // Lazy-load deploy modules and SST Resource
  const { Resource } = await import("sst");
  const { uploadKitBundle } = await import("../../deploy/upload.js");
  const { seedRegistry } = await import("../../deploy/seed-registry.js");
  const { provisionKitLambda } = await import("../../deploy/deploy-lambda.js");

  // 1. Upload to S3
  await uploadKitBundle({
    buildDir,
    kitId,
    bucketName: (Resource as any).KitAssets.name,
  });

  // 2. Seed registry
  await seedRegistry({
    tursoUrl: (Resource as any).TursoDbUrl.value,
    tursoToken: (Resource as any).TursoAuthToken.value,
    manifest,
    shellS3Key: `apps/kits/${kitId}/shell.html`,
    visibility: isPublic ? "public" : "private",
    authorId: creds.email,
  });

  // 3. Provision Lambda
  const infra = (Resource as any).KitLambdaInfra;
  if (infra?.roleArn && infra?.layerArn) {
    const result = await provisionKitLambda({
      kitId,
      bucketName: (Resource as any).KitAssets.name,
      bundleS3Key: `bundles/${kitId}/kit.mjs`,
      roleArn: infra.roleArn,
      runtimeLayerArn: infra.layerArn,
    });
    console.log(`\n  Lambda: ${result.functionName} (${result.created ? "created" : "updated"})`);
  } else {
    console.warn("\n  Skipping Lambda (KitLambdaInfra not configured).");
  }

  // 4. Grant deployer access (authz tuple)
  try {
    const { createClient } = await import("@libsql/client");
    const { nanoid } = await import("nanoid");
    const client = createClient({
      url: (Resource as any).TursoDbUrl.value,
      authToken: (Resource as any).TursoAuthToken.value,
    });

    // Look up userId from email
    const userResult = await client.execute({
      sql: "SELECT id FROM user WHERE email = ?",
      args: [creds.email],
    });
    const userId = userResult.rows[0]?.id as string | undefined;

    if (userId) {
      const kitSlug = `${kitId}-kit`;
      await client.execute({
        sql: `INSERT OR IGNORE INTO authz_tuples (id, subject_type, subject_id, relation, object_type, object_id)
              VALUES (?, 'user', ?, 'activator', 'kit', ?)`,
        args: [nanoid(), userId, kitSlug],
      });
      await client.execute({
        sql: `INSERT OR IGNORE INTO authz_tuples (id, subject_type, subject_id, relation, object_type, object_id)
              VALUES (?, 'user', ?, 'author', 'kit', ?)`,
        args: [nanoid(), userId, kitSlug],
      });
      console.log(`  Access granted: ${creds.email} → ${kitSlug} (activator + author)`);
    } else {
      console.warn(`  Could not find user for ${creds.email} — grant access manually.`);
    }

    client.close();
  } catch (err: any) {
    console.warn(`  Authz grant failed: ${err.message}`);
  }

  console.log(`\n✅ Kit "${kitId}" deployed (${isPublic ? "public" : "private"}).\n`);
  process.exit(0);
}
