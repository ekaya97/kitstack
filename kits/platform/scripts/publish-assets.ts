import { resolve } from "node:path";
import { Resource } from "sst";
import { uploadKitBundle } from "@kitstackco/sdk/deploy/upload";

const kitRoot = resolve(import.meta.dirname, "..");
const buildDir = resolve(kitRoot, ".kitstack", "build");

await uploadKitBundle({
  buildDir,
  kitId: "platform",
  bucketName: Resource.KitAssets.name,
});

console.log("Published platform View shell at apps/kits/platform/shell.html");
