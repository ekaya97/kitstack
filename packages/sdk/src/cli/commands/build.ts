import { resolve } from "path";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync, execSync } from "node:child_process";
import { buildKit } from "../../build";

const BUILD_HELP = `
kitstack build — validate and bundle kit for deployment

Usage:
  kitstack build [options]

Options:
  --config <path>  Path to kit root directory (default: .)
  --container       Build the generated container context with Docker/Podman
  --engine <name>   Container engine (default: KITSTACK_CONTAINER_ENGINE or docker)
  --image <ref>     Image reference (default: <kit-id>:<version>)
  --base-image <ref> Base image for the generated Containerfile
  --sign-key <path> Sign artifact metadata with the contents of this file
  --help, -h       Show help
`.trim();

export async function build(args: string[]) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(BUILD_HELP);
    process.exit(0);
  }

  let kitRoot = process.cwd();

  const configIdx = args.indexOf("--config");
  if (configIdx !== -1 && args[configIdx + 1]) {
    kitRoot = resolve(args[configIdx + 1]);
  }

  const valueFor = (flag: string) => {
    const index = args.indexOf(flag);
    return index !== -1 && args[index + 1] ? args[index + 1] : undefined;
  };
  const image = valueFor("--image");
  const baseImage = valueFor("--base-image");
  const signKeyPath = valueFor("--sign-key");
  const signingKey = signKeyPath ? readFileSync(resolve(kitRoot, signKeyPath), "utf8").trim() : undefined;

  console.log(`\n  Building kit at ${kitRoot}...\n`);

  // Generate migrations from Drizzle schema if drizzle.config.ts exists
  const drizzleConfig = resolve(kitRoot, "drizzle.config.ts");
  if (existsSync(drizzleConfig)) {
    try {
      execSync("npx drizzle-kit generate", { cwd: kitRoot, stdio: "inherit" });
    } catch {
      console.warn("  Warning: drizzle-kit generate failed. Continuing with existing migrations.\n");
    }
  }

  try {
    const result = await buildKit(kitRoot, { image, baseImage, signingKey });

    if (args.includes("--container")) {
      const engine = valueFor("--engine") ?? process.env.KITSTACK_CONTAINER_ENGINE ?? "docker";
      const tag = image ?? result.container.image;
      console.log(`  Building container image ${tag} with ${engine}...\n`);
      try {
        execFileSync(
          engine,
          ["build", "--file", result.container.containerfile, "--tag", tag, result.container.contextDir],
          { stdio: "inherit" },
        );
        console.log(`\n  ✓ Container image built: ${tag}\n`);
      } catch (err: any) {
        console.error(`\n  Container build failed with ${engine}: ${err.message}\n`);
        process.exit(1);
      }
    }
  } catch (err: any) {
    console.error(`\n  Build failed: ${err.message}\n`);
    process.exit(1);
  }
}
