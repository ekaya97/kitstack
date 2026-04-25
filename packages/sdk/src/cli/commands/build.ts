import { resolve } from "path";
import { buildKit } from "../../build";

const BUILD_HELP = `
kitstack build — validate and bundle kit for deployment

Usage:
  kitstack build [options]

Options:
  --config <path>  Path to kit root directory (default: .)
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

  console.log(`\n  Building kit at ${kitRoot}...\n`);

  try {
    await buildKit(kitRoot);
  } catch (err: any) {
    console.error(`\n  Build failed: ${err.message}\n`);
    process.exit(1);
  }
}
