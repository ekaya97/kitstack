/**
 * Deploy expense-tax-prep kit using SDK deploy pipeline.
 *
 * Run from project root:
 *   npx sst shell -- npx tsx kits/expense-tax-prep/deploy.ts
 */
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { Resource } from "sst";
import { uploadKitBundle } from "../../packages/sdk/src/deploy/upload";
import { seedRegistry, type KitManifest } from "../../packages/sdk/src/deploy/seed-registry";
import { provisionKitLambda } from "../../packages/sdk/src/deploy/deploy-lambda";

const KIT_ID = "expense-tax-prep";
const buildDir = resolve(import.meta.dirname, ".kitstack/build");

const manifest: KitManifest = JSON.parse(
  readFileSync(resolve(buildDir, "manifest.json"), "utf-8")
);

async function deploy() {
  console.log(`\n🔧 Deploying kit "${KIT_ID}"...\n`);

  await uploadKitBundle({
    buildDir,
    kitId: KIT_ID,
    bucketName: (Resource as any).KitAssets.name,
  });

  await seedRegistry({
    tursoUrl: (Resource as any).TursoDbUrl.value,
    tursoToken: (Resource as any).TursoAuthToken.value,
    manifest,
    shellS3Key: `apps/kits/${KIT_ID}/shell.html`,
  });

  const roleArn = (Resource as any).KitLambdaRoleArn.value;
  const layerArn = (Resource as any).KitRuntimeLayerArn.value;

  if (!roleArn || !layerArn) {
    console.log("\n⚠ Skipping Lambda provisioning (KitLambdaRoleArn or KitRuntimeLayerArn not set).");
    return;
  }

  const result = await provisionKitLambda({
    kitId: KIT_ID,
    bucketName: (Resource as any).KitAssets.name,
    bundleS3Key: `bundles/${KIT_ID}/kit.mjs`,
    roleArn,
    runtimeLayerArn: layerArn,
  });

  console.log(`\n✅ Kit "${KIT_ID}" deployed. Lambda: ${result.functionName} (${result.created ? "created" : "updated"})\n`);
}

deploy().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
