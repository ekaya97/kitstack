# Dev Notes: Dev Command, Build Validation, Router Cleanup

Tickets: T-0004, T-0019, T-0035

---

## What was built

### T-0004: `kitstack dev --stdio`

The `dev` command at `packages/sdk/src/cli/commands/dev.ts` is the local development entry point. It loads a kit from `kit.config.ts`, provisions a local SQLite database, and serves MCP JSON-RPC over stdio.

**Architecture:** The command is thin glue — it wires three existing building blocks:
- `provisionDevDb()` (T-0027) creates/migrates `.kitstack/dev.db`
- `createMcpHandler()` (T-0024) handles MCP protocol dispatch
- Node's `readline` reads newline-delimited JSON-RPC from stdin

```typescript
// The core loop is ~15 lines:
const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  const request = JSON.parse(line.trim());
  const response = await handler.handleRequest(request);
  if (response !== null) {
    process.stdout.write(JSON.stringify(response) + "\n");
  }
});
```

**Flags:**
- `--stdio` — stdio transport (for Claude Desktop/Code)
- `--views` — View DevKit mode (delegates to `devkit/server.ts`)
- `--config <path>` — custom kit config path (default: `kit.config.ts`)
- `--db <path>` — custom database path (default: `.kitstack/dev.db`)
- `--reset-db` — delete and re-provision the database

**Claude Desktop integration:**
```json
{ "command": "npx", "args": ["kitstack", "dev", "--stdio"] }
```

### T-0019: Build validation wiring

Wired the `defineKit()` validation (tool name/description checks, duplicate detection) into the build pipeline at `packages/sdk/src/build.ts`. Before this, validation only ran at runtime when `defineKit()` was called. Now `kitstack build` surfaces `KitStackError` codes and doc URLs.

Key change: removed redundant manual duplicate checks from the build — `defineKit()` already handles those at load time. The build retains only the file-system check (verifying `View.tsx` exists for each view) since that's a build concern, not a definition concern.

### T-0035: Router VIEW_DATA removal

Removed the hardcoded `VIEW_DATA` map and `KIT_APPS_FALLBACK` from the production router (`packages/mcp-server/src/router/`). View descriptions now come exclusively from the `kit_views` registry table in Turso.

Before: `getKitApps()` had a fallback map for non-CRM kits. `handleShowApp()` read view descriptions from a hardcoded `VIEW_DATA` object.

After: `getKitApps()` reads only from the registry. `handleShowApp()` uses the `description` column from `kit_views`. The legacy `cmd`/`params` fields in the data payload were removed — loaders replace cmd-based data fetching.

---

## What was learned

### Kit config loading requires absolute paths

The `import()` call in the dev command needs an absolute path. When running `npx kitstack dev --stdio` from a kit directory, the relative `kit.config.ts` must be resolved against `process.cwd()`:

```typescript
const fullConfigPath = resolve(process.cwd(), configPath);
const mod = await import(fullConfigPath);
kit = mod.default ?? mod;
```

The `mod.default ?? mod` pattern handles both `export default defineKit(...)` and `module.exports = defineKit(...)`.

### Notifications must not produce responses

MCP notifications (JSON-RPC requests without an `id`) must return nothing — not even `null`. The handler returns `null` for notifications, and the stdio loop checks for this:

```typescript
if (response !== null) {
  process.stdout.write(JSON.stringify(response) + "\n");
}
```

Sending a response to a notification violates the MCP spec and causes client-side errors.

### Parse errors need careful handling

Invalid JSON on stdin must return a `-32700` parse error, not crash the process. The try/catch around `JSON.parse` ensures the dev server stays alive even if the client sends malformed input.

### Build validation is best as delegation, not duplication

T-0019 started by adding validation checks to the build pipeline that duplicated what `defineKit()` already does. The better pattern: let `defineKit()` throw on load (it already does), catch the error in the build, and format it. The build only adds file-system checks that `defineKit()` can't do (like verifying `View.tsx` exists on disk).

### Registry migration is safe with IF NOT EXISTS

T-0035 removed the VIEW_DATA fallback, which means all kits must be registered in `kit_views` before they work. The CRM kit was already registered. Other kits need `INSERT INTO kit_views` during deployment. The `CREATE TABLE IF NOT EXISTS` in the migration SQL ensures the table exists without affecting existing data.

---

## How to use it

### Running the dev server

From any kit directory:

```sh
# Start stdio server (for Claude Desktop/Code)
npx kitstack dev --stdio

# Start with a fresh database
npx kitstack dev --stdio --reset-db

# Use a custom config
npx kitstack dev --stdio --config ./my-kit.config.ts
```

### Testing the dev server manually

Pipe JSON-RPC to stdin:

```sh
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  | npx kitstack dev --stdio
```

Multi-message test:

```sh
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' \
  | npx kitstack dev --stdio
```

### End-to-end with the CRM kit

```sh
cd kits/crm
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"add_contact","arguments":{"name":"Alice"}}}\n{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_contacts","arguments":{}}}\n' \
  | npx tsx ../../packages/sdk/src/cli/index.ts dev --stdio --reset-db
```

This produces three responses: server info, "Contact added", and a markdown table with Alice.

### Build validation

The build surfaces defineKit errors with codes and doc URLs:

```
KitValidationError [KIT_DUPLICATE_TOOLS]: Kit "crm" has duplicate tool names: list_contacts.
  → https://docs.kitstack.dev/errors/KIT_DUPLICATE_TOOLS
```

View file checks run after defineKit validation:

```
View 'pipeline' references component but View.tsx not found at src/views/pipeline/View.tsx
```
