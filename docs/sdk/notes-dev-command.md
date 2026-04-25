# Dev Notes: `kitstack dev --stdio`, Build Validation, VIEW_DATA Removal

Tickets: T-0004, T-0019, T-0035

---

## What was built

### Dev server with stdio transport (T-0004)

The `kitstack dev` command (`packages/sdk/src/cli/commands/dev.ts`) starts a local MCP server that connects a kit to Claude Desktop or Claude Code.

**Two transport modes:**

- `--stdio` reads newline-delimited JSON-RPC from stdin and writes responses to stdout. This is the primary development workflow. Zero network overhead.
- `--views` starts a Vite-backed HTTP server for developing view components with HMR (separate DevKit concern, not covered in detail here).

**Startup sequence:**

1. Parse CLI flags (`--stdio`, `--config`, `--db`, `--reset-db`, `--views`, `--port`).
2. Load `kit.config.ts` via dynamic `import()` -- this runs `defineKit()` which validates tools, views, schemas.
3. Provision a local SQLite database at `.kitstack/dev.db` using `provisionDevDb()`. Migration SQL runs on every start (idempotent CREATE TABLE IF NOT EXISTS).
4. Create the MCP handler via `createMcpHandler({ kit, db })`.
5. Wire up `readline` on stdin; each line is parsed as JSON-RPC and dispatched to the handler.

**MCP protocol coverage:**

| Method | Behavior |
|--------|----------|
| `initialize` | Returns server info + capabilities (including `io.modelcontextprotocol/ui` for MCP Apps) |
| `notifications/initialized` | Acknowledged, no response (notification) |
| `ping` | Returns `{}` |
| `tools/list` | Returns the two-tool surface: `kit` + `kit_view` |
| `tools/call` | Dispatches to `handleKit()` or `handleKitView()` |

### Build validation step (T-0019)

Validation happens in `kitstack build` (`packages/sdk/src/build.ts`), not in the dev server. This is intentional -- dev should be fast, build should be thorough.

**What build validates:**

- Kit config loads without errors (schema violations from `defineKit()` surface as `KitStackError` with error codes and doc URLs).
- View.tsx files exist on disk for every declared view (`src/views/{slug}/View.tsx`).
- Migration SQL is syntactically valid -- each statement is executed against an in-memory SQLite database.
- DROP statements are rejected with `MIGRATION_DROP_FORBIDDEN` (hard rule, not configurable).
- Server bundle size warnings (>1MB).
- View module size warnings (>500KB per module).

**Why validation is in build, not dev:**

During `kitstack dev`, the developer is iterating. Running migration SQL against in-memory SQLite on every restart would add latency and mask real errors (the dev database already exists and may have drifted from the migration). Build runs once before publish and catches everything.

### VIEW_DATA removal from router (T-0035)

The original router design had a separate `VIEW_DATA` message type for delivering loader data to the app shell. This was removed in favor of inline data delivery.

**How it works now:**

When `kit_view(view="contacts")` is called, the handler:

1. Runs the view's `loader(db, ctx)` to get data.
2. Returns two content blocks in the tool result:
   - A `text` block containing JSON: `{ kit, view, app, data }`.
   - A `resource` block with `mimeType: "text/html;profile=mcp-app"` containing the pre-built shell HTML.

The shell parses the JSON from the text block and mounts the view with the pre-loaded data. No second round-trip, no `VIEW_DATA` event, no router involvement.

**Before (removed):**

```
Client -> tools/call kit_view(view) -> server
Server -> tool result (shell HTML only) -> client
Client renders shell -> shell sends VIEW_DATA request -> server
Server -> VIEW_DATA response (loader data) -> shell
Shell mounts view with data
```

**After (current):**

```
Client -> tools/call kit_view(view) -> server
Server runs loader, returns [JSON data, shell HTML] -> client
Client renders shell -> shell reads data from tool result -> mounts view
```

The `__load_view` internal command on the `kit` tool still exists for view reloads (called by `useKit().reload()` from the client-side SDK hooks), but the initial load no longer needs it.

---

## What was learned

### Gotchas with stdio transport

**Never write non-JSON to stdout.** Any `console.log()` in tool handlers or loaders that writes to stdout will corrupt the JSON-RPC stream. Claude Desktop/Code will reject the line as a parse error. All developer-facing output goes to stderr via `console.error()`.

**Process lifecycle is managed by the client.** When Claude Desktop closes the MCP server, it closes stdin. The `readline` `close` event fires and we call `process.exit(0)`. There is no graceful shutdown protocol in MCP -- the client just kills the pipe. This means:

- No cleanup hooks run unless you listen for `close` explicitly.
- Database connections are not explicitly closed (SQLite handles this fine via OS-level file handle cleanup).
- If the kit has long-running async work when stdin closes, it may be orphaned. This has not been an issue in practice because tool handlers are short-lived.

**`--reset-db` is essential during schema iteration.** SQLite's `CREATE TABLE IF NOT EXISTS` is idempotent for the table name, but if you change column definitions, the old table persists with the old schema. During active schema development, always use `--reset-db` or manually delete `.kitstack/dev.db`.

**Parse errors return `id: null`.** When the incoming line is not valid JSON, we return a JSON-RPC error with `id: null` (per spec, since we cannot determine the request ID). Claude Desktop handles this gracefully.

### Process lifecycle edge cases

**Multiple concurrent requests.** The readline-based transport processes one line at a time, but `handler.handleRequest()` is async. If the client sends two requests before the first completes, they run concurrently. This is fine because the MCP handler is stateless per-request and SQLite serializes writes. However, if a kit tool mutates shared state (unlikely given the architecture), this could be a source of bugs.

**No backpressure.** If stdout's write buffer fills up (e.g., a tool returns a very large result), `process.stdout.write()` will buffer in Node.js. This has not been an issue in practice because tool results are typically small (a few KB of JSON + shell HTML).

### Build validation timing

Running migration validation at build time (not dev time) was the right call. During development, the `.kitstack/dev.db` file is the source of truth, and re-running migrations against in-memory SQLite would catch syntax errors but not semantic drift. Build validation catches the class of errors that matter before deployment: SQL that fails on a fresh database.

---

## How to use it

### Local development workflow with Claude Desktop

1. Create or navigate to your kit directory (e.g., `kits/crm`).

2. Add an MCP server entry to Claude Desktop's config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "crm": {
      "command": "npx",
      "args": ["tsx", "packages/sdk/src/cli/index.ts", "dev", "--stdio"],
      "cwd": "/absolute/path/to/kitstack/kits/crm"
    }
  }
}
```

3. Restart Claude Desktop. The CRM kit's tools (`add_contact`, `list_contacts`, etc.) and views (`contacts`, `pipeline`, etc.) appear in the tool list.

4. Iterate: edit tool handlers or view components, then restart the MCP server (Claude Desktop menu > restart server or restart the app).

### Resetting the database

```sh
cd kits/crm
npx kitstack dev --stdio --reset-db
```

This deletes `.kitstack/dev.db` and re-runs migrations. Use this when you change your schema.

### Running build validation before publishing

```sh
cd kits/crm
npx kitstack build
```

Output shows each validation step with checkmarks:

```
  Building kit at /path/to/kits/crm...

  ✓ Loaded kit.config.ts — "CRM Kit" (12 tools, 5 views)
  ✓ Migration SQL valid (8 statements)
  ✓ Validation passed
  ✓ Server bundle: .kitstack/build/kit.mjs (24.3 KB)
  ...
```

If migration SQL contains a DROP statement, build fails with:

```
  ✗ MIGRATION_DROP_FORBIDDEN: Migration SQL contains a DROP command...
```

### View development with the DevKit

```sh
cd kits/crm
npx kitstack dev --views --port 5174
```

This starts a Vite dev server with HMR for view components. Open `http://localhost:5174` to see views rendered with mock data.
