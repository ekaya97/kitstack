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

3. **server.ts** + **app.html** — DevKit HTTP server and host page. Sidebar with view list, double iframe viewport, panels for data inspection, tool call logging, capability toggles, and viewport sizing.

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
