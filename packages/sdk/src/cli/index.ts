#!/usr/bin/env node

const VERSION = "0.0.1";

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
