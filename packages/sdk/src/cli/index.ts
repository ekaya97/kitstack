#!/usr/bin/env node

/**
 * KitStack CLI entry point.
 *
 * Registered as the `kitstack` bin in `package.json` under
 * `"bin": { "kitstack": "./src/cli/index.ts" }`. Routes subcommands
 * to their handler modules via dynamic `import()` so only the invoked
 * command's dependencies are loaded (e.g., `kitstack --version` never
 * loads esbuild or Vite).
 *
 * The five routed commands are:
 *
 * | Command        | Handler module         | Ticket |
 * |----------------|------------------------|--------|
 * | `init <name>`  | `./commands/init.ts`   | T-0022 |
 * | `dev`          | `./commands/dev.ts`    | T-0004 |
 * | `build`        | `./commands/build.ts`  | T-0023 |
 * | `login`        | `./commands/login.ts`  | future |
 * | `publish`      | `./commands/publish.ts`| future |
 *
 * Each command module exports a single async function that receives
 * the remaining argv (everything after the subcommand name). Commands
 * parse their own flags internally (e.g., `dev.ts` handles `--stdio`,
 * `--config`, `--db`).
 *
 * @example Scaffold a new kit and start local dev:
 * ```bash
 * npx kitstack init my-crm-kit
 * cd my-crm-kit && npm install
 * npx kitstack dev --stdio
 * ```
 *
 * @example Claude Desktop MCP config pointing to a kit:
 * ```json
 * {
 *   "mcpServers": {
 *     "crm": {
 *       "command": "npx",
 *       "args": ["tsx", "packages/sdk/src/cli/index.ts", "dev", "--stdio"],
 *       "cwd": "/path/to/kits/crm"
 *     }
 *   }
 * }
 * ```
 *
 * @example Run in the monorepo during development via tsx:
 * ```bash
 * npx tsx packages/sdk/src/cli/index.ts dev --stdio
 * npx tsx packages/sdk/src/cli/index.ts build --config ./kits/crm
 * ```
 *
 * @remarks
 * No CLI framework is used (no commander, citty, etc.). The router is
 * a plain `switch/case` on `process.argv[2]`. This keeps the
 * dependency footprint minimal and avoids version churn from framework
 * upgrades. If shared flag parsing or auto-generated help is needed in
 * the future, a framework can be added without changing the public
 * command surface.
 *
 * The `.js` extension in dynamic imports (e.g.,
 * `import("./commands/init.js")`) is intentional: TypeScript's
 * `moduleResolution: "bundler"` resolves `.js` to `.ts` at dev time,
 * and the compiled output will have actual `.js` files.
 *
 * @packageDocumentation
 */

/**
 * Current SDK version, printed by `kitstack --version`.
 *
 * @example
 * ```bash
 * $ npx kitstack --version
 * 0.0.1
 * ```
 */
const VERSION = "0.0.1";

/**
 * Help text printed when no command is given or when `--help` / `-h`
 * is passed. Lists all available commands and global options.
 */
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
 * CLI main entry point. Reads `process.argv`, extracts the subcommand,
 * and dispatches to the matching handler via dynamic import.
 *
 * **Exit codes:**
 * - `0` — `--help` or `--version` printed successfully.
 * - `1` — unknown command, or the command handler threw an error.
 *
 * The remaining args after the subcommand are forwarded to the handler
 * as a `string[]`. For example, `kitstack dev --stdio --reset-db`
 * calls `dev(["--stdio", "--reset-db"])`.
 *
 * @example How dispatching works internally:
 * ```typescript
 * // argv: ["node", "kitstack", "init", "my-crm-kit"]
 * // command = "init", commandArgs = ["my-crm-kit"]
 * const { init } = await import("./commands/init.js");
 * await init(["my-crm-kit"]);
 * ```
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
