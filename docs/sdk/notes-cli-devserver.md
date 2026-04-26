# SDK Dev Notes — CLI, Dev Server, View DevKit, serve()

Tickets: T-0003, T-0006, T-0007, T-0009, T-0018, T-0020, T-0026, T-0028, T-0036, T-0038, T-0039, T-0040, T-0041

---

## What was built

### Build pipeline (`packages/sdk/src/build.ts`)

`buildKit(kitRoot)` — validates and bundles a kit for deployment. Pipeline:

1. **Load** — imports `kit.config.ts` via tsx ESM loader
2. **Validate** — `defineKit()` runs all validations at import time (snake_case names, description length, kebab-case view slugs, `.describe()` warnings). Build catches `KitStackError` and surfaces the code + doc URL. Build adds file-system checks (View.tsx existence).
3. **Bundle server** — esbuild, ESM target, externalizes `@libsql/client`, `drizzle-orm`, `zod`
4. **Generate view entries** — one `{slug}.tsx` per view with `import * as ViewModule` + `mount()`
5. **Bundle views** — Vite with `manualChunks` (React → `vendor.js`, shared hooks → `shared.js`)
6. **Tailwind CSS** — `tailwindcss` CLI with per-kit config
7. **Generate shell** — `generateShell()` bakes kit config into the MCP Apps shell HTML
8. **Manifest** — `manifest.json` with hashes, sizes, SDK version (read from package.json)

Bundle size warnings fire at >1MB (server) or >500KB (view modules/shared chunks).

```typescript
// kits/crm/build.ts — entire file
import { buildKit } from "../../packages/sdk/src/build";
buildKit(import.meta.dirname);
```

### Shell template (`packages/sdk/src/shell-template.ts`)

`generateShell(config)` produces a self-contained HTML shell that:

- Handles the MCP Apps postMessage protocol (sandbox-proxy-ready handshake, ui/initialize, tool-result)
- Loads view modules from CDN (vendor.js → shared.js → per-view.js)
- Falls back to markdown rendering when CDN is unavailable
- Sets up `window.__KITSTACK_MCP__` bridge for React views to call tools

The shell is a build artifact — each kit gets its own shell with baked-in config.

### serve() runtime (`packages/sdk/src/server/index.ts`)

`serve(options)` — batteries-included MCP server. Wires together:

- MCP handler (from `createMcpHandler`)
- Auth adapter (`none()` default, `kitstack()` or `oauth()` for production)
- Database connection via `@libsql/client`
- Transport: stdio (for Claude Desktop/Code) or HTTP (for production)

```typescript
// Self-hosted with HTTP transport
import { serve } from "@kitstack/sdk/server";
import kit from "./kit.config";

serve({
  kit,
  db: { url: process.env.DATABASE_URL!, authToken: process.env.DATABASE_TOKEN },
  transport: "http",
  port: 3000,
});
```

HTTP transport exposes:
- `POST /` — MCP JSON-RPC endpoint (validates Bearer token via auth adapter)
- `GET /.well-known/oauth-authorization-server` — OAuth metadata from the auth adapter

### stdio transport (`packages/sdk/src/runtime/stdio.ts`)

`runStdioTransport(handler, opts)` — reads NDJSON from stdin, writes responses to stdout. All diagnostic output goes to stderr. Handles:

- Partial line buffering (stdin chunks may not align with line boundaries)
- Graceful shutdown on SIGINT/SIGTERM and stdin close
- JSON-RPC validation (ignores malformed messages instead of crashing)
- Pipelining (processes lines as they arrive, doesn't await between requests)

Custom stream overrides make it testable without actual stdin/stdout.

### View DevKit (`packages/sdk/src/devkit/`)

Local MCP Apps renderer for view development. Three layers:

1. **host.ts** — `createMcpAppsHost()`: mock MCP Apps client implementing the full postMessage protocol (ui/initialize, tools/call, ui/download-file, ui/open-link, __load_view, size-changed). Logs all tool calls for the inspector panel.

2. **proxy.ts** — `generateProxyHtml()`: mock sandbox proxy that replicates Claude.ai's double iframe architecture. Handles sandbox-proxy-ready → sandbox-resource-ready handshake, forwards postMessages between inner iframe and host.

3. **server.ts** + **app.html** — DevKit HTTP server and host page. Sidebar with view list, double iframe viewport, panels for data inspection (editable, with placeholder fallback), tool call logging, capability toggles, and viewport sizing.

Started via `kitstack dev --views` (defaults to port 5174).

API endpoints:
- `GET /` — DevKit host page (injects kit metadata as `window.__DEVKIT_KIT__`)
- `GET /__devkit/shell` — Dev shell HTML
- `GET /__devkit/proxy` — Mock proxy HTML
- `GET /__devkit/loader/:slug` — Execute a view's loader, return JSON
- `POST /__devkit/tool` — Execute a tool handler, return KitToolResult

### Build manifest SDK version (T-0020)

Fixed hardcoded `"0.0.1"` → reads from `packages/sdk/package.json` dynamically:
```typescript
sdkVersion: JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "package.json"), "utf-8")).version,
```

---

## What was learned

### Gotcha: esbuild can't handle React for browser ESM

esbuild with `splitting: true` produces `chunk-HASH.js` filenames that aren't predictable. When React is marked as external, the output has bare specifiers (`import { useState } from "react"`) that browsers can't resolve. When React is bundled per-view, multiple React instances crash hooks.

**Fix:** Vite for view builds with `manualChunks` — React goes into `vendor.js`, shared hooks into `shared.js`, all views share one React instance.

### Gotcha: defineKit validation runs at import time

When `kit.config.ts` is imported during the build, `defineKit()` throws validation errors immediately. The build had a generic catch that would say "Failed to load kit.config.ts" instead of showing the validation error code.

**Fix:** Check `instanceof KitStackError` in the catch and surface `e.code`, `e.message`, and `e.docUrl`.

### Gotcha: vendor.js/shared.js path conflicts between kits

CRM kit uploads its Vite-built vendor.js/shared.js to `apps/` — same path as the platform's shared assets. Other kits would overwrite them.

**Fix:** Namespace kit uploads under `apps/kits/{kitId}/` (done in the outreach and meeting kit upload scripts).

### Gotcha: CloudFront caching in dev

After uploading to S3, CloudFront serves stale content until invalidated (30-120 seconds). During development, all files use `Cache-Control: max-age=0, no-cache, no-store, must-revalidate`.

### Gotcha: stdio transport must not write to stdout

Any console.log during MCP stdio mode corrupts the protocol stream. All diagnostic output must go to stderr. The `serve()` function writes its startup banner to `process.stderr.write()`.

### Gotcha: DevKit double iframe is required

The double iframe is not just for security — it affects data delivery timing. The sandbox-proxy-ready → sandbox-resource-ready handshake, the tool-result notification ordering, and postMessage origin checks all break differently with a single iframe. The DevKit replicates the exact production architecture.

---

## How to use it

### Build a kit

```bash
cd kits/crm
npx tsx build.ts
# Output at .kitstack/build/ (kit.mjs, views/, shell.html, manifest.json)
```

Or via CLI:
```bash
npx kitstack build --config ./kits/crm
```

### Run locally with Claude Desktop

```bash
cd kits/crm
npx kitstack dev --stdio
```

Claude Desktop MCP config:
```json
{
  "mcpServers": {
    "crm": {
      "command": "npx",
      "args": ["kitstack", "dev", "--stdio"],
      "cwd": "/path/to/kits/crm"
    }
  }
}
```

### Develop views locally

```bash
cd kits/crm
npx kitstack dev --views
# Opens http://localhost:5174
```

Click a view in the sidebar → loader runs against local SQLite → view renders in double iframe with the same postMessage protocol as production.

#### View placeholders

Views can define optional `placeholder` data in `defineView()`. When the loader returns empty/null (e.g., fresh database), the DevKit falls back to the placeholder and displays it in the Data Inspector with a `PLACEHOLDER` tag.

```typescript
export default defineView({
  slug: "contact-detail",
  name: "Contact Detail",
  description: "to view detailed contact info with deals and activity",
  loader,
  component: ContactDetailView,
  placeholder: {
    contact: { id: "c1", name: "Jane Doe", company: "Acme Corp", email: "jane@acme.co", ... },
    deals: [{ id: "d1", name: "Brand Refresh", value: 18000, stage: "proposal", ... }],
    recentActivities: [{ id: "a1", type: "meeting", description: "Kick-off call", ... }],
  },
});
```

The placeholder is typed against the loader's return type — TypeScript errors if the shape doesn't match.

The Data Inspector is editable: modify the JSON and click **"Send to view"** to re-render the component with the edited data. The source tag shows `LOADER`, `PLACEHOLDER`, or `EDITED` depending on the data origin.

**Production stripping:** `defineKit()` extracts placeholders from view definitions and stores them in `kit._placeholders`. The `placeholder` field is deleted from each view, so it never appears in the production server bundle (`kit.mjs`). The DevKit server reads `_placeholders` and injects them into the host page as `window.__DEVKIT_KIT__.placeholders`.

**Restart required:** Placeholder changes require restarting `kitstack dev` since the kit config is imported once at startup. View component changes (View.tsx) are hot-reloaded by Vite without restart.

### Self-host a kit

```typescript
// server.ts
import { serve } from "@kitstack/sdk/server";
import kit from "./kit.config";

serve({
  kit,
  db: { url: "file:./data/production.db" },
  transport: "http",
  port: 3000,
});
```

### Reset dev database

```bash
npx kitstack dev --stdio --reset-db
```

Deletes `.kitstack/dev.db` and re-runs migrations from scratch.

---

## Build pipeline deep dive

Tickets: T-0042, T-0043, T-0044, T-0045, T-0046

### View bundling with Vite and manualChunks

Views are bundled with Vite (not esbuild) because esbuild's `splitting: true` produces unpredictable `chunk-HASH.js` filenames, and marking React as external leaves bare specifiers that browsers can't resolve.

Vite's `rollupOptions.output.manualChunks` splits view bundles into three tiers:

| Chunk | Contents | Rationale |
|---|---|---|
| `vendor.js` | `react`, `react-dom`, `scheduler` | Shared across all views, cached separately |
| `shared.js` | Anything under `src/shared/` (hooks, components) | Kit-level shared code |
| `{kitId}/{slug}.js` | Per-view entry module | Only loaded when that view is displayed |

The Vite config is generated at build time and written to `.kitstack/build/_vite.config.ts`. It uses `@shared` as a resolve alias pointing at the SDK's `views/src/shared/` directory. `cssCodeSplit` is disabled so all CSS lands in a single file.

### Per-kit Tailwind CSS processing

If both `src/views/styles.css` and `tailwind.config.ts` exist in the kit root, the build runs:

```bash
npx tailwindcss -i "src/views/styles.css" -o ".kitstack/build/views/style.css" --config "tailwind.config.ts" --minify
```

Each kit has its own Tailwind config, so content paths and theme extensions are scoped. The output is a single minified `style.css` placed alongside the view JS modules.

### Generated view entry points

For each view defined in `kit.config.ts`, the build generates a `main.tsx`-style entry at `.kitstack/build/_entries/{slug}.tsx`. The generated code:

1. Imports `createRoot` from `react-dom/client`
2. Imports `* as ViewModule` from the kit's `src/views/{slug}/View.tsx`
3. Resolves the component via default export or first exported function
4. Exports a `mount(container, data)` function that renders the component
5. Registers itself on `window.__KITSTACK_VIEWS__["{kitId}/{slug}"]`

This pattern lets the shell discover and mount views by convention without the kit author writing any boilerplate.

### Manifest generation with hashes and sizes

The manifest (`manifest.json`) is the source of truth for deployment. It includes:

- `kitId`, `kitName`, `version`, `sdkVersion` (read from `packages/sdk/package.json`)
- `tools[]` — name and description of each tool
- `views[]` — slug, name, description of each view
- `migrationSql` — raw SQL string for database provisioning
- `serverBundle` — `{ file, hash, sizeBytes }` where hash is `sha256:<first-12-hex-chars>`
- `viewModules[]` — per-view `{ slug, file, hash, sizeBytes }`
- `viewCss` — `{ file, sizeBytes }` if Tailwind output exists
- `shell` — `{ file, sizeBytes }` if shell HTML was generated

Hashes use SHA-256 truncated to 12 hex characters, prefixed with `sha256:`.

### Build summary output

The build prints a step-by-step summary to stdout:

```
  ✓ Loaded kit.config.ts — "CRM Kit" (12 tools, 5 views)
  ✓ Migration SQL valid (4 statements)
  ✓ Validation passed
  ✓ Server bundle: .kitstack/build/kit.mjs (42.3 KB)
  ✓ Generated 5 view entries
  ✓ View bundles: 5 view modules + 2 shared chunks (187.4 KB total)
  ✓ CSS: .kitstack/build/views/style.css (8.2 KB)
  ✓ Shell: .kitstack/build/shell.html (3.1 KB)
  ✓ Manifest: .kitstack/build/manifest.json
```

Warnings fire at >1 MB for server bundles and >500 KB for individual view modules or shared chunks.

---

## kitstack publish command workflow

Ticket: T-0046

`kitstack publish` (`packages/sdk/src/cli/commands/publish.ts`) submits a built kit to the KitStack marketplace. Steps:

1. **Auth check** — loads credentials from `~/.kitstack/credentials.json` (written by `kitstack login`). Exits if not authenticated.
2. **Build if needed** — if `.kitstack/build/manifest.json` doesn't exist, runs `buildKit(kitRoot)` automatically. Otherwise uses existing build output (prints a hint to rebuild manually).
3. **Read manifest** — parses `manifest.json`, logs kit name/id/version and tool/view counts.
4. **Collect assets** — reads `kit.mjs` (server bundle), recursively collects all files under `views/`, and reads `shell.html` if present.
5. **Upload** — sends a single JSON POST to `{KITSTACK_API_URL}/kits/publish` with:
   - `manifest` — the parsed manifest object
   - `bundle` — server bundle as base64
   - `shell` — shell HTML as base64 (or null)
   - `views[]` — array of `{ name, content }` with base64-encoded view assets
6. **Confirm** — prints the kit ID, version, and review status from the API response.

The API URL defaults to `https://api.kitstack.co` and can be overridden via `KITSTACK_API_URL` env var.

---

## Authorize hook wiring

Ticket: T-0062, T-0012

### defineTool authorize hook

Tools can define an optional `authorize` hook that returns an array of `AuthzRequirement` objects. Each requirement specifies a `relation`, `objectType`, and `objectId` — a tuple that the authz engine checks before allowing the tool call.

```typescript
defineTool({
  name: "delete_sequence",
  description: "Delete an outreach sequence",
  args: z.object({ sequenceId: z.string() }),
  authorize: (args, ctx) => [
    { relation: "owner", objectType: "sequence", objectId: args.sequenceId },
  ],
  handler: async (db, args, ctx) => { /* ... */ },
});
```

### MCP handler wiring

In `createMcpHandler` (`packages/sdk/src/runtime/mcp-handler.ts`), the `checkAuthz` config option is called for each `AuthzRequirement` returned by the tool's `authorize` hook:

- If `checkAuthz` is provided and any check returns `false`, the tool call is rejected with a "Forbidden" error.
- If `checkAuthz` is omitted, authorize hooks are skipped entirely (all calls permitted). This is the default for local dev.

```typescript
createMcpHandler({
  kit,
  db,
  checkAuthz: async (db, requirement, ctx) => {
    // Query your authz engine (e.g., OpenFGA, custom RBAC table)
    return true; // or false to deny
  },
});
```

### createTestKit wiring

In `createTestKit` (`packages/sdk/src/testing/index.ts`), the same pattern applies:

- Pass `checkAuthz` in the options to test authorization logic.
- Omit it to skip authz checks (convenient for unit tests that focus on business logic).

```typescript
const testKit = await createTestKit(kitDef, {
  checkAuthz: async (db, req, ctx) => {
    // Custom test logic — e.g., only allow "test-user"
    return ctx.userId === "test-user";
  },
});
```

Both `createMcpHandler` and `createTestKit` follow the same contract: `authorize` hook produces requirements, `checkAuthz` evaluates them, absence of `checkAuthz` means "permit all".
