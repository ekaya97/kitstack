# CLI Entry Point & Command Routing — Dev Notes

Ticket: T-0021

## What was built

The `kitstack` CLI entry point at `packages/sdk/src/cli/index.ts`. This is the `bin` script registered in `package.json` that routes subcommands to their handler modules.

### The bin registration

```json
{
  "bin": {
    "kitstack": "./src/cli/index.ts"
  }
}
```

This gives users `npx kitstack <command>` when the package is installed. During monorepo development, it is invoked via `npx tsx packages/sdk/src/cli/index.ts <command>` instead.

### Commands routed

| Command | Module | Handler signature | Implementation ticket |
|---------|--------|-------------------|-----------------------|
| `init <name>` | `./commands/init.ts` | `init(args: string[])` | T-0022 |
| `dev` | `./commands/dev.ts` | `dev(args: string[])` | T-0004 |
| `build` | `./commands/build.ts` | `build(args: string[])` | T-0023 |
| `login` | `./commands/login.ts` | `login(args: string[])` | (future) |
| `publish` | `./commands/publish.ts` | `publish(args: string[])` | (future) |

Each command module exports a single async function that receives `commandArgs` — everything from `process.argv` after the subcommand name.

### Design decisions

**No CLI framework dependency.** The router is ~30 lines of hand-rolled `switch/case`. We considered `commander` and `citty` but the overhead is not justified for routing 5 commands. Each command parses its own flags internally (e.g., `dev.ts` handles `--stdio`, `--config`, `--db`, `--reset-db`, `--views`, `--port`). If we need shared flag parsing or help generation later, we can add a framework without changing the public command surface.

**Lazy imports via dynamic `import()`.** Each command is loaded only when invoked:

```typescript
case "init": {
  const { init } = await import("./commands/init.js");
  await init(commandArgs);
  break;
}
```

This keeps startup fast — `kitstack --version` does not load esbuild, Vite, drizzle, or any heavy dependencies that individual commands pull in. It also means the cost of adding new commands (login, publish) is zero for users who never call them.

**bin registration uses raw `.ts` path.** The `package.json` registers `"kitstack": "./src/cli/index.ts"` (not `./dist/cli/index.mjs`). This works during development because the monorepo uses `tsx` as a TypeScript loader. For the published npm package, this will need to point to the built output — handled when we set up `tsup` (T-0005).

**Global `--help` and `--version` handled before dispatch.** The entry point intercepts `--help`, `-h`, `--version`, and `-v` before reaching the switch statement. Individual commands can also define their own `--help` (e.g., `build.ts` has `BUILD_HELP`).

## What was learned

### `.js` extension in dynamic imports

The `import("./commands/init.js")` uses a `.js` extension even though the source file is `init.ts`. This is required for ESM module resolution — TypeScript's `moduleResolution: "bundler"` resolves `.js` imports to `.ts` source files during development, and the compiled output will have actual `.js` files. If you write `import("./commands/init.ts")` it will fail at runtime in the compiled output.

### argv slicing

`process.argv.slice(2)` gives everything after `node script.ts`. The first element is the subcommand, the rest are forwarded as `commandArgs`:

```
argv: ["node", "kitstack", "dev", "--stdio", "--reset-db"]
       ╰──────slice(2)───────╯
       command = "dev"
       commandArgs = ["--stdio", "--reset-db"]
```

This simple split works because each command handles its own flag parsing. No shared flag parsing or middleware is needed.

### Exit codes

The entry point uses `process.exit(1)` for unknown commands and wraps the entire `main()` in a `.catch()` that prints the error message and exits 1. Individual commands also call `process.exit(1)` on validation failures (e.g., `kitstack init` without a name, `kitstack dev` without `--stdio` or `--views`).

### ESM bin scripts and tsx

The shebang `#!/usr/bin/env node` works when Node runs the compiled `.js` output. During development, the monorepo runs the `.ts` source through `tsx`, so the shebang is not used — instead it is invoked as `npx tsx packages/sdk/src/cli/index.ts`. The Claude Desktop MCP config uses this tsx-based invocation for local development:

```json
{
  "mcpServers": {
    "crm": {
      "command": "npx",
      "args": ["tsx", "packages/sdk/src/cli/index.ts", "dev", "--stdio"],
      "cwd": "/path/to/kits/crm"
    }
  }
}
```

### No top-level await

The entry point uses `main().catch(...)` instead of top-level await. This avoids issues with certain Node.js versions and bundlers that do not support top-level await in bin scripts. The `main` function itself is async to allow dynamic imports.

## How to use it

### Basic commands

```bash
# Show help (lists all available commands)
npx kitstack
npx kitstack --help

# Show version
npx kitstack --version

# Scaffold a new kit (T-0022)
npx kitstack init my-crm-kit

# Start dev server for Claude Desktop (T-0004)
npx kitstack dev --stdio

# Start dev server with custom config and database
npx kitstack dev --stdio --config ./kit.config.ts --db ./data/test.db

# Reset the dev database on startup
npx kitstack dev --stdio --reset-db

# Validate and bundle for deployment (T-0023)
npx kitstack build

# Unknown commands print help and exit 1
npx kitstack foobar
# → "Unknown command: foobar"
```

### During monorepo development

When working inside the kitstack monorepo, run via tsx since the bin is not globally linked:

```bash
npx tsx packages/sdk/src/cli/index.ts init my-kit
npx tsx packages/sdk/src/cli/index.ts dev --stdio
npx tsx packages/sdk/src/cli/index.ts --version
```

### Adding a new command

To add a new command (e.g., `kitstack migrate`):

1. Create `packages/sdk/src/cli/commands/migrate.ts` exporting `async function migrate(args: string[])`.
2. Add a case to the switch in `index.ts`:
   ```typescript
   case "migrate": {
     const { migrate } = await import("./commands/migrate.js");
     await migrate(commandArgs);
     break;
   }
   ```
3. Add the command to the `HELP` string.
