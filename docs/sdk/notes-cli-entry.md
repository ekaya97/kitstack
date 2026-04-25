# CLI Entry Point — Dev Notes

Ticket: T-0021

## What was built

The `kitstack` CLI entry point at `packages/sdk/src/cli/index.ts`. This is the `bin` script registered in `package.json` that routes subcommands to their implementations.

### Commands routed

| Command | Module | Implementation ticket |
|---------|--------|-----------------------|
| `init <name>` | `./commands/init.ts` | T-0022 |
| `dev` | `./commands/dev.ts` | T-0004 |
| `build` | `./commands/build.ts` | T-0023 |
| `login` | `./commands/login.ts` | (future) |
| `publish` | `./commands/publish.ts` | (future) |

### Design decisions

**No CLI framework dependency.** The router is ~30 lines of hand-rolled `switch/case`. We considered `commander` and `citty` but the overhead isn't justified for routing 5 commands. Each command parses its own flags internally (e.g., `dev.ts` handles `--stdio`, `--config`, `--db`). If we need shared flag parsing or help generation later, we can add a framework then.

**Lazy imports via dynamic `import()`.** Each command is loaded only when invoked:

```typescript
case "init": {
  const { init } = await import("./commands/init.js");
  await init(commandArgs);
  break;
}
```

This keeps startup fast — `kitstack --version` doesn't load esbuild, Vite, or any heavy dependencies that individual commands pull in.

**bin registration uses raw `.ts` path.** The `package.json` registers `"kitstack": "./src/cli/index.ts"` (not `./dist/cli/index.mjs`). This works during development because the monorepo uses `tsx` as a TypeScript loader. For the published npm package, this would need to point to the built output — handled when we set up `tsup` (T-0005).

## What was learned

### argv handling

`process.argv.slice(2)` gives us everything after `node script.ts`. The first element is the subcommand, the rest are forwarded as `commandArgs`. This simple split works because commands handle their own flag parsing.

### Exit codes

The entry point uses `process.exit(1)` for unknown commands and catches unhandled errors from command implementations. Individual commands also call `process.exit(1)` on validation failures (e.g., `kitstack init` without a name).

### `.js` extension in dynamic imports

The `import("./commands/init.js")` uses `.js` extension even though the source is `.ts`. This is required for ESM resolution — TypeScript's `moduleResolution: "bundler"` resolves `.js` imports to `.ts` source files during development, and the built output will have actual `.js` files.

## How to use it

```bash
# Show help
npx kitstack

# Show version
npx kitstack --version

# Scaffold a new kit (T-0022)
npx kitstack init my-crm-kit

# Start dev server for Claude Desktop (T-0004)
npx kitstack dev --stdio

# Validate and bundle (T-0023)
npx kitstack build

# Unknown commands show help and exit 1
npx kitstack foobar
# → "Unknown command: foobar"
```

During development in the monorepo, run via tsx:

```bash
npx tsx packages/sdk/src/cli/index.ts init my-kit
npx tsx packages/sdk/src/cli/index.ts --version
```
