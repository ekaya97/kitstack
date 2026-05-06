/**
 * Deploy CRM kit using SDK deploy pipeline.
 *
 * Run from project root:
 *   npx sst shell -- npx tsx kits/crm/deploy.ts
 *
 * Steps:
 *   1. Upload build artifacts to S3 (views, shell, server bundle, manifest)
 *   2. Seed kit_registry + kit_views tables in Turso
 *   3. Create or update Kit-crm Lambda
 */
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { Resource } from "sst";
import { uploadKitBundle } from "../../packages/sdk/src/deploy/upload";
import { seedRegistry, type KitManifest } from "../../packages/sdk/src/deploy/seed-registry";
import { provisionKitLambda } from "../../packages/sdk/src/deploy/deploy-lambda";

const KIT_ID = "crm";
const buildDir = resolve(import.meta.dirname, ".kitstack/build");

const manifest: KitManifest = JSON.parse(
  readFileSync(resolve(buildDir, "manifest.json"), "utf-8")
);

async function deploy() {
  console.log(`\n🔧 Deploying kit "${KIT_ID}"...\n`);

  // 1. Upload to S3
  await uploadKitBundle({
    buildDir,
    kitId: KIT_ID,
    bucketName: (Resource as any).KitAssets.name,
  });

  // 2. Seed registry
  const viewPreviewKeys: Record<string, string> = {};
  for (const p of manifest.previews ?? []) {
    viewPreviewKeys[p.slug] = `apps/kits/${KIT_ID}/previews/${p.slug}.html`;
  }

  await seedRegistry({
    tursoUrl: (Resource as any).TursoDbUrl.value,
    tursoToken: (Resource as any).TursoAuthToken.value,
    manifest,
    shellS3Key: `apps/kits/${KIT_ID}/shell.html`,
    viewPreviewKeys,
  });

  // 3. Provision Lambda
  const { roleArn, layerArn, subnetIds, securityGroupIds } = (Resource as any).KitLambdaInfra;

  const result = await provisionKitLambda({
    kitId: KIT_ID,
    bucketName: (Resource as any).KitAssets.name,
    bundleS3Key: `bundles/${KIT_ID}/kit.zip`,
    roleArn,
    runtimeLayerArn: layerArn,
    subnetIds,
    securityGroupIds,
  });

  console.log(`\n✅ Kit "${KIT_ID}" deployed. Lambda: ${result.functionName} (${result.created ? "created" : "updated"})\n`);
}

deploy().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
