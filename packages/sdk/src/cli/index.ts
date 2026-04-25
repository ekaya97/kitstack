#!/usr/bin/env node

/**
 * KitStack CLI entry point.
 *
 * Registered as the `kitstack` bin in package.json. Routes subcommands
 * to their implementations via dynamic import so only the invoked
 * command's code is loaded.
 *
 * @example
 * ```bash
 * # Show available commands
 * npx kitstack
 *
 * # Scaffold a new kit
 * npx kitstack init my-crm-kit
 *
 * # Start local dev server for Claude Desktop
 * npx kitstack dev --stdio
 *
 * # Validate and bundle for deployment
 * npx kitstack build
 * ```
 *
 * @remarks
 * Commands are lazy-loaded from `./commands/*.ts`. Each command module
 * exports a single async function that receives the remaining argv
 * after the subcommand name. Individual command implementations are
 * in separate tickets (T-0022 init, T-0004 dev, T-0023 build, etc.).
 *
 * @packageDocumentation
 */

/** Current SDK version, shown by `kitstack --version`. */
const VERSION = "0.0.1";

/** Help text shown when no command is given or `--help` is passed. */
const HELP = `
kitstack — build AI-native kits with the KitStack SDK

Usage:
  kitstack <command> [options]

Commands:
  init <name>     Scaffold a new kit project
  dev             Start local dev server
  build           Validate and bundle kit for deployment
  login           Authenticate with KitStack
  publish         Submit kit to KitStack marketplace

Options:
  --help, -h      Show help
  --version, -v   Show version
`.trim();

/**
 * CLI main — parse the subcommand from argv and dispatch to the
 * appropriate handler. Unknown commands print help and exit 1.
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    console.log(HELP);
    process.exit(0);
  }

  if (command === "--version" || command === "-v") {
    console.log(VERSION);
    process.exit(0);
  }

  const commandArgs = args.slice(1);

  switch (command) {
    case "init": {
      const { init } = await import("./commands/init.js");
      await init(commandArgs);
      break;
    }
    case "dev": {
      const { dev } = await import("./commands/dev.js");
      await dev(commandArgs);
      break;
    }
    case "build": {
      const { build } = await import("./commands/build.js");
      await build(commandArgs);
      break;
    }
    case "login": {
      const { login } = await import("./commands/login.js");
      await login(commandArgs);
      break;
    }
    case "publish": {
      const { publish } = await import("./commands/publish.js");
      await publish(commandArgs);
      break;
    }
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
