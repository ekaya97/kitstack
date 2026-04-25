# SDK Dev Notes — CLI, Dev Server, View DevKit, serve(), Build Pipeline, Kit Migrations

Covers: T-0003, T-0006, T-0007, T-0009, T-0018, T-0020, T-0026, T-0028, T-0036, T-0038, T-0039, T-0040, T-0041

---

## What was built

### Build pipeline hardening (T-0018, T-0020)

`buildKit()` in `packages/sdk/src/build.ts` is the core build entry point. It loads `kit.config.ts`, validates, bundles, and produces `.kitstack/build/`.

**Migration SQL validation** runs each statement individually against in-memory SQLite. Errors now include the statement index and starting line number:

```
Migration SQL error at statement 3 (line 14): near 'CREAT': syntax error
         Statement: CREAT TABLE IF NOT EXISTS prospects...
```

**DROP rejection** scans every statement before execution. Single-line comments are stripped first so `-- DROP TABLE` in a comment doesn't false-positive:

```typescript
const normalized = stmt.sql.replace(/--[^\n]*/g, "").trim();
if (/^\s*DROP\s+/i.test(normalized)) {
  throw new MigrationError("MIGRATION_DROP_FORBIDDEN", ...);
}
```

**SDK version in manifest** — `sdkVersion` is read from the SDK's `package.json` at build time via `createRequire`, not hardcoded. This is needed for the deployment pipeline to track which SDK version a kit was built with.

### stdio transport (T-0026)

`packages/sdk/src/runtime/stdio.ts` — `runStdioTransport(handler)` reads newline-delimited JSON-RPC from stdin, routes through the MCP handler, writes responses to stdout. Diagnostic output goes to stderr.

Key design decision: we don't `await` each line sequentially. The MCP protocol allows pipelining — the client can send multiple requests before waiting for responses. So `processLine` is fire-and-forget (`void processLine(line)`).

Gotcha: stdin chunks don't align with line boundaries. The buffer accumulates partial data and only processes complete lines (split on `\n`).

### serve() entry point (T-0038)

`packages/sdk/src/server/index.ts` provides a batteries-included MCP server:

```typescript
import { serve, none } from "@kitstack/sdk/server";
import kit from "./kit.config";

serve({
  kit,
  auth: none(),
  db: { url: "file:.kitstack/dev.db" },
  transport: "stdio",  // or "http"
  port: 3000,
});
```

Two transports: stdio (for Claude Desktop/Code) and HTTP (for web clients). The HTTP transport exposes:
- `POST /` — MCP JSON-RPC endpoint
- `GET /.well-known/oauth-authorization-server` — OAuth metadata from the auth adapter

Auth validation on HTTP: if a Bearer token is present, it's validated via `auth.validate()`. If validation fails, 401. If no token is present, the request proceeds (the `none()` adapter always succeeds).

### Auth adapters (T-0037)

`packages/sdk/src/server/auth/adapter.ts` defines `AuthAdapter` — the interface for pluggable authentication. Five methods: `metadata()`, `authorize()`, `token()`, `revoke()`, `validate()`.

`none()` adapter: all validation succeeds with a fixed user ID. Used by `kitstack dev` and integration tests. Configurable: `none({ userId: "test-42" })`.

### CLI scaffold (T-0003, T-0006)

`packages/sdk/src/cli/index.ts` is the `bin` entry point. Routes subcommands to lazy-loaded modules via `switch`/`case` with dynamic `import()`. No CLI framework — each command parses its own flags internally.

The `init` command (`cli/commands/init.ts`) scaffolds a full kit directory:

```bash
npx kitstack init cold-outreach
# Creates:
#   cold-outreach/
#     kit.config.ts, package.json, tsconfig.json, tailwind.config.ts
#     src/schema.ts, src/migrations.ts, src/instructions.ts
#     src/tools/example.ts
#     src/views/dashboard/{index,loader,View}.tsx
#     test/tools.test.ts
```

The `dev` command (`cli/commands/dev.ts`) supports two modes:
- `--stdio` — MCP JSON-RPC over stdin/stdout for Claude Desktop/Code
- `--views` — View DevKit HTTP server with HMR (starts the devkit server)

Additional flags: `--config <path>`, `--db <path>`, `--reset-db`, `--port <n>`.

### Shell template (T-0009, T-0028)

`packages/sdk/src/shell-template.ts` — `generateShell(config: ShellConfig)` produces the HTML file that runs inside the Claude.ai MCP Apps iframe. The `ShellConfig` interface captures kit-specific values baked in at build time:

```typescript
interface ShellConfig {
  kitId: string;       // e.g. "crm"
  platformCdn: string; // shared vendor/shared.js host
  kitCdn: string;      // per-kit view modules host
  views: Array<{ slug: string; height?: number }>;
}
```

Two rendering paths in the generated HTML:
- **React path** (production): loads `vendor.js` + `shared.js` + `{slug}.js` from CDN, mounts React component with pre-loaded loader data
- **Markdown fallback** (local dev / CDN unavailable): calls the `kit` tool via `tools/call`, renders the text result with a built-in markdown-to-HTML converter

The shell registers view mount functions on `window.__KITSTACK_VIEWS__["{kitId}/{slug}"]`. The MCP Apps postMessage bridge (`window.__KITSTACK_MCP__`) provides `callTool()`, `downloadFile()`, `openLink()`, and `copyToClipboard()` to view components.

### Kit migrations and dev database (T-0007, T-0036)

Migration SQL is a raw string in the kit definition (`migrationSql` field). The build pipeline validates each statement against in-memory SQLite. At dev time, `provisionDevDb()` in `packages/sdk/src/runtime/dev-db.ts` creates a local SQLite file:

```typescript
import { provisionDevDb } from "@kitstack/sdk/runtime/dev-db";

// First run: creates file and runs migrations
const db = await provisionDevDb(".kitstack/dev.db", migrationSql);

// Reset on each restart
const db = await provisionDevDb(".kitstack/dev.db", migrationSql, { reset: true });
```

The `--reset-db` flag on `kitstack dev` deletes the file and re-runs migrations from scratch.

### Build pipeline detail (T-0041)

`buildKit(kitRoot)` in `packages/sdk/src/build.ts` runs nine steps:

1. Locate `kit.config.ts` and `handler.ts`
2. Load kit definition via tsx (surfaces `KitStackError` with codes/URLs)
3. Validate: check View.tsx exists, validate migration SQL, reject DROP
4. Bundle server: esbuild `handler.ts` into `kit.mjs` (ESM, Node 22)
5. Generate view entries: per-view `.tsx` files with `mount()` registration
6. Bundle views: Vite with React plugin, manual chunks (vendor + shared)
7. Compile CSS: Tailwind with kit config
8. Generate shell: `generateShell()` into `shell.html`
9. Write manifest: `manifest.json` with hashes, sizes, tool/view metadata

Output: `.kitstack/build/` with `kit.mjs`, `manifest.json`, `shell.html`, and `views/`.

The `BuildResult` type returned on success:

```typescript
interface BuildResult {
  manifest: Record<string, unknown>; // also written to manifest.json
  outputDir: string;                  // absolute path to .kitstack/build/
}
```

### View DevKit mock host (T-0039)

`packages/sdk/src/devkit/host.ts` — `createMcpAppsHost()` implements the MCP Apps postMessage protocol that Claude.ai uses:

| Protocol message | Host behavior |
|---|---|
| `ui/initialize` | Returns configurable capabilities |
| `tools/call` | Routes to kit's tool handler, logs call |
| `__load_view` | Re-executes view loader (for `reload()`) |
| `ui/download-file` | Delegates to callback |
| `ui/open-link` | Delegates to callback |
| `ui/notifications/size-changed` | Delegates to callback |

The host also provides:
- `buildToolResultNotification(viewSlug)` — runs the loader and builds the JSON-RPC notification the shell expects
- `getToolCallLogs()` — returns logged tool calls for the inspector panel
- `setCapabilities(caps)` — toggle capabilities live (for testing responsive behavior)

### Mock sandbox proxy (T-0040)

`packages/sdk/src/devkit/proxy.ts` — `generateProxyHtml()` produces the outer iframe HTML that mimics Claude.ai's sandbox proxy. The double-iframe structure:

```
Host page (DevKit UI)
  └── Outer iframe (proxy.html via srcdoc)
        └── Inner iframe (shell.html via srcdoc, set after handshake)
```

The handshake:
1. Outer iframe loads → sends `sandbox-proxy-ready` to inner
2. Inner iframe (shell) receives → sends back `sandbox-resource-ready` with its own HTML
3. Outer writes the HTML into inner via `srcdoc`
4. All subsequent messages are forwarded bidirectionally

---

## What was learned

### Statement-level SQL validation catches real bugs

The old "run all SQL at once" approach masked errors — SQLite would fail on the first bad statement but the error message didn't say which one. Running statements individually with line tracking made migration debugging dramatically better during kit development.

### DROP rejection is a hard requirement

The user's CLAUDE.md explicitly forbids DROP commands. We enforce this at the build level too, not just at the AI level. The regex strips comments first: `-- DROP TABLE old_thing` in a comment shouldn't block the build.

### The double iframe is essential for production fidelity

We originally considered skipping the proxy iframe for the DevKit (simpler). But the `sandbox-resource-ready` handshake — where the shell sends its own HTML back to the proxy, which then writes it into the inner iframe — is a real protocol step that can fail. The CRM kit's generated shell had a bug where this handshake never completed in production. Having the double iframe in dev mode would have caught it earlier.

### `void processLine()` is intentional, not a mistake

The stdio transport processes lines without awaiting. This looks wrong but is correct — MCP allows request pipelining. If we awaited each line, a slow tool call would block all subsequent requests. The trade-off: responses may arrive out of order, but JSON-RPC handles that via request IDs.

### Auth adapter interface is minimal by design

The `AuthAdapter` has five methods that map 1:1 to OAuth 2.0 endpoints. We considered adding `getUserProfile()` or `getRoles()` but decided against it — the only thing the MCP runtime needs is a `userId` string. Kit tools that need richer identity can query their own database.

### Shell's `__KITSTACK_VIEWS__` registry requires kit-namespaced keys

View modules register on `window.__KITSTACK_VIEWS__["{kitId}/{slug}"]`. The shell looks up this key when a tool result contains `{ view: "slug" }`. Without the kit ID namespace, two kits loaded in the same page (unlikely in MCP Apps, possible in DevKit) would collide.

### esbuild externals list is manually maintained

The server bundle externalizes `@libsql/client`, `drizzle-orm`, `drizzle-orm/*`, and `zod`. These are provided at runtime. If a kit imports another heavy library (e.g., `pdf-lib`), it gets bundled into `kit.mjs`. There is no automatic external detection — if the bundle gets large, check for accidentally bundled dependencies.

### Vite manual chunks prevent React duplication

Without `manualChunks`, each per-view module bundles its own React (~140 KB). The split into `vendor.js` (react/react-dom/scheduler) and `shared.js` (shared components) keeps total size linear in shared code, not in view count.

### CLI `bin` uses `.ts` path during monorepo development

`package.json` registers `"kitstack": "./src/cli/index.ts"`, not a compiled output. This works because the monorepo uses `tsx` as a TypeScript loader. For the published npm package, this will need to point to built output (handled when `tsup` is set up).

### `.js` extension in dynamic imports is required for ESM

`import("./commands/init.js")` uses `.js` even though the source is `.ts`. TypeScript's `moduleResolution: "bundler"` resolves `.js` to `.ts` during development, and built output has actual `.js` files.

### `provisionDevDb` splits on ";" naively

Migration SQL is split on `;` boundaries. This works for standard SQL but would break if a semicolon appeared inside a string literal or trigger body. For now, kit migration SQL avoids this. If triggers or stored procedures are ever needed, a proper SQL tokenizer would be required.

---

## How to use it

### Build a kit

```bash
npx kitstack build                    # from kit root
npx kitstack build --config ../my-kit # from elsewhere
```

The build validates migration SQL (including DROP rejection), bundles server code with esbuild, builds view modules with Vite, compiles Tailwind CSS, generates a shell, and writes a manifest.

### Run locally with stdio

```bash
npx kitstack dev --stdio    # connect Claude Desktop/Code to this
```

Or programmatically:

```typescript
import { createMcpHandler } from "@kitstack/sdk/runtime";
import { runStdioTransport } from "@kitstack/sdk/runtime/stdio";
import kit from "./kit.config";

const handler = createMcpHandler({ kit, db });
await runStdioTransport(handler);
```

### Self-host with serve()

```typescript
import { serve, none } from "@kitstack/sdk/server";
import kit from "./kit.config";

// stdio (Claude Desktop)
serve({ kit, auth: none(), db: { url: "file:dev.db" } });

// HTTP (any client)
serve({ kit, auth: none(), db: { url: "file:dev.db" }, transport: "http", port: 3000 });
```

### Use the mock host for view testing

```typescript
import { createMcpAppsHost } from "@kitstack/sdk/devkit";
import kit from "./kits/crm/kit.config";

const host = createMcpAppsHost({
  kit,
  db,
  ctx: { userId: "dev", kitId: kit.id },
  onToolCall: (log) => {
    console.log(`[${log.toolName}] ${log.durationMs}ms`, log.args);
  },
});

// Get initial data for a view
const notification = await host.buildToolResultNotification("pipeline");

// Handle messages from an iframe
const response = await host.handleMessage(incomingMessage);
```

### Scaffold a new kit

```bash
npx kitstack init cold-outreach
cd cold-outreach
npm install
npx kitstack dev --stdio
```

The generated kit includes a working example tool, a dashboard view, migration SQL, and a vitest test file using `createTestKit()`.

### Claude Desktop MCP config

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

### View development with DevKit

```bash
cd kits/crm
npx kitstack dev --views --port 5174
# Open http://localhost:5174
```

The DevKit page shows all views and tools, executes loaders in real-time, and simulates the Claude.ai MCP Apps iframe sandboxing.

### Reset the dev database

```bash
npx kitstack dev --stdio --reset-db
```

Deletes `.kitstack/dev.db` and re-runs migrations from scratch. Useful when schema changes make the existing database incompatible.

### Inspect build output

```bash
npx kitstack build
cat .kitstack/build/manifest.json | python3 -m json.tool
```

The manifest lists every tool, view, bundle hash, and file size. Use it to verify the build before publishing.
