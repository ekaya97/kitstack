# Build Pipeline Hardening & serve() Runtime — Dev Notes

Tickets: T-0005 (bundle size warnings), T-0038 (serve() entry point)

## What was built

### Bundle size warnings (T-0005)

Three size gates were added to `buildKit()` in `packages/sdk/src/build.ts`:

1. **Server bundle gate** — warns when the esbuild output (`kit.mjs`) exceeds 1 MB. Message suggests splitting large dependencies.
2. **View module gate** — warns when any individual view module (e.g., `crm/pipeline.js`) exceeds 500 KB. Message suggests code-splitting or reducing dependencies.
3. **Shared chunk gate** — warns when any shared chunk (vendor, shared) exceeds 500 KB. Message notes this may slow down initial view loads.

All three are non-blocking warnings (`console.warn`), not hard failures. The rationale: a kit author should know about bloat during development, but there are legitimate reasons for large bundles (e.g., a charting library). A hard fail would require an escape hatch flag, adding CLI surface area we don't need yet.

### serve() entry point (T-0038)

A new `@kitstack/sdk/server` export in `packages/sdk/src/server/index.ts` that wires together the MCP handler, a database connection, and an auth adapter into a complete runnable server.

```typescript
import { serve, none } from "@kitstack/sdk/server";
import kit from "./kit.config";

serve({
  kit,
  auth: none(),
  db: { url: "file:.kitstack/dev.db" },
  transport: "stdio",
});
```

Two transport modes are implemented:

| Transport | Use case | Protocol |
|-----------|----------|----------|
| `stdio` | Local dev with Claude Desktop / `kitstack dev` | Newline-delimited JSON-RPC over stdin/stdout |
| `http` | Production self-hosted deployment | HTTP POST to `/`, OAuth metadata at `/.well-known/oauth-authorization-server` |

The auth layer is pluggable via `AuthAdapter`. Currently shipped:

- `none()` — dev-only adapter that always validates, returns a fixed `"local-dev-user"` userId. Exposes dummy OAuth metadata pointing at localhost.

Future adapters (planned but not yet implemented):

- `kitstack()` — uses KitStack as identity provider (validates invocation tokens)
- `oauth()` — brings your own OAuth server for third-party clients

## What was learned

### stdio transport: stderr for logging, stdout for protocol

This is easy to get wrong. The stdio MCP transport uses stdout exclusively for JSON-RPC messages. Any human-readable output (startup banner, errors) must go to stderr. The `serve()` function uses `process.stderr.write()` for the startup banner. If you accidentally `console.log()` a debug message, it will be parsed as a malformed JSON-RPC message by the client.

### Newline-delimited JSON-RPC requires buffering

Incoming chunks from `process.stdin` do not align with message boundaries. A single `data` event might contain half a message, or multiple messages. The stdio transport accumulates data in a buffer and scans for `\n` delimiters, processing one complete message per newline. This is the same framing the official MCP SDK uses.

### Bundle size thresholds are pragmatic, not scientific

The 1 MB server / 500 KB view thresholds were chosen based on deploying the CRM and outreach kits. Both produce server bundles under 200 KB and view modules under 100 KB when properly configured. The thresholds are ~5-10x headroom above observed sizes, catching genuine bloat (accidentally bundling `@libsql/client` or React into the server) without false positives.

esbuild externals are critical here. Without the `external` list (`@libsql/client`, `drizzle-orm`, `zod`), the server bundle balloons past 1 MB easily because `@libsql/client` bundles native bindings.

### Vite output paths differ between single-view and multi-view kits

Vite with `rollupOptions.input` as a `Record<string, string>` outputs files into a nested directory structure matching the input keys. When a kit has ID `crm` and a view slug `pipeline`, the input key is `crm/pipeline` and Vite outputs to `views/crm/pipeline.js` (nested), not `views/pipeline.js` (flat). The build pipeline checks for both structures: if `views/{kitId}/` exists, it iterates nested files; otherwise it falls back to flat.

### HTTP transport: auth is optional but the endpoint always exists

The `/.well-known/oauth-authorization-server` endpoint is always served (even with `none()` auth), returning the adapter's metadata. This matches the MCP spec's discovery mechanism — clients probe this endpoint to learn what auth flow to use. The `none()` adapter returns localhost URLs, which a conformant client would recognize as "no real auth."

When a Bearer token is present on POST `/`, it is validated through the adapter. But when no token is sent, the request proceeds unauthenticated. This is intentional for dev mode but will need tightening for production adapters — a `kitstack()` adapter should reject unauthenticated requests.

### The `await new Promise(() => {})` keep-alive

Both transports end with `await new Promise(() => {})` to prevent the async function from returning and Node from exiting. This works because the promise never resolves, keeping the event loop alive indefinitely. The stdin listener (stdio) or HTTP server (http) do the actual work. This is a common Node pattern for long-running servers but looks odd if you haven't seen it before.

## How to use it

### Build pipeline warnings

No configuration required. Run `kitstack build` (or call `buildKit()` directly) and warnings appear inline:

```
  > Server bundle: .kitstack/build/kit.mjs (142.3 KB)
  > View bundles: 3 view modules + 2 shared chunks (287.5 KB total)
```

If something is too large, you'll see:

```
  > Server bundle: .kitstack/build/kit.mjs (1.3 MB)
  ! Server bundle is 1.3 MB. Consider splitting large dependencies.
```

To fix server bundle bloat, check the esbuild `external` list in `build.ts`. Heavy packages that exist in the Lambda runtime (like `@libsql/client`) should be externalized, not bundled. For view bloat, look at your component's dependency tree — tree-shaking only works if you import specific subpaths (e.g., `import { format } from "date-fns/format"` not `import { format } from "date-fns"`).

### serve() for self-hosted MCP

Create a `server.ts` at the root of your kit:

```typescript
import { serve, none } from "@kitstack/sdk/server";
import kit from "./kit.config";

// Local development (connect via Claude Desktop stdio)
serve({
  kit,
  auth: none(),
  db: { url: "file:.kitstack/dev.db" },
  transport: "stdio",
});
```

Run it:

```bash
npx tsx server.ts
```

For production HTTP deployment:

```typescript
serve({
  kit,
  auth: none(), // Replace with kitstack() or oauth() when available
  db: {
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
  transport: "http",
  port: Number(process.env.PORT) || 3000,
});
```

### Claude Desktop integration (stdio)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-kit": {
      "command": "npx",
      "args": ["tsx", "/path/to/kit/server.ts"]
    }
  }
}
```

The server logs its startup banner to stderr so you can see it in the terminal without corrupting the JSON-RPC stream.

### Common mistakes

1. **Forgetting to externalize heavy deps in custom build configs.** If you override esbuild options, make sure `@libsql/client`, `drizzle-orm`, and `zod` stay external. Bundling them inflates the server bundle and can cause native module issues.

2. **Using `console.log` during request handling in stdio mode.** Anything written to stdout is treated as a JSON-RPC response. Use `process.stderr.write()` or `console.error()` for debug output.

3. **Expecting `none()` auth to reject unauthenticated requests.** It doesn't. The `none()` adapter is a dev convenience that accepts everything. Never use it in production.
