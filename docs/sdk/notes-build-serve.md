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

Additional adapters (see "Auth Adapters & Monolith Mode" section below):

- `kitstack()` — uses KitStack as identity provider (OAuth 2.0 authorization code flow)
- `oauth()` — bring your own OAuth provider for fully self-hosted kits

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
  auth: none(), // Replace with kitstack() or oauth() for production
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

---

## Auth Adapters & Monolith Mode

Tickets: T-0058 (kitstack auth adapter), T-0059 (oauth auth adapter), T-0060 (monolith serve mode)

### kitstack() auth adapter

The `kitstack()` adapter delegates identity to KitStack's own OAuth 2.0 authorization server. It implements the full `AuthAdapter` interface by proxying to KitStack's endpoints:

| Adapter method | KitStack endpoint | Purpose |
|----------------|-------------------|---------|
| `metadata()` | (constructed locally) | Returns OAuth server metadata with `issuer`, `authorization_endpoint`, `token_endpoint`, `revocation_endpoint` all under `kitstackUrl` |
| `authorize()` | `GET /oauth/authorize` | Redirects the MCP client to KitStack's consent screen, passing `client_id`, `redirect_uri`, `response_type=code`, `state` |
| `token()` | `POST /oauth/token` | Exchanges an authorization code (or refresh token) for access credentials; injects `client_id` + `client_secret` into the form body |
| `revoke()` | `POST /oauth/revoke` | Revokes a token; injects client credentials |
| `validate()` | `GET /oauth/userinfo` | Sends a `Bearer` token and reads the `sub` claim from the response JSON to get the `userId` |

Key details:

- **Token validation hits `/oauth/userinfo`**, not a token introspection endpoint. KitStack's identity provider returns a standard OpenID Connect userinfo response with at minimum a `sub` field. No client credentials are needed for this call — only the bearer token.
- **OAuth server metadata is constructed in-memory** from the `kitstackUrl` base, not fetched from a `/.well-known/` endpoint. This avoids a network round-trip on every metadata request and guarantees the endpoint URLs are consistent.
- The `kitstackUrl` defaults to `https://kitstack.co` and is stripped of trailing slashes.
- `grant_types_supported` includes both `authorization_code` and `refresh_token`, enabling long-lived sessions without re-authentication.
- `token_endpoint_auth_methods_supported` is `["client_secret_post"]` — credentials are sent in the POST body, not via HTTP Basic auth.

```typescript
import { serve, kitstack } from "@kitstack/sdk/server";
import kit from "./kit.config";

serve({
  kit,
  auth: kitstack({
    clientId: process.env.KITSTACK_CLIENT_ID!,
    clientSecret: process.env.KITSTACK_CLIENT_SECRET!,
  }),
  db: { url: process.env.DATABASE_URL! },
  transport: "http",
  port: 3000,
});
```

### oauth() auth adapter

The `oauth()` adapter is for fully self-hosted kits that manage their own user identity — no KitStack dependency. You provide three callbacks (`authorize`, `validateToken`, and optionally `exchangeCode` and `revokeToken`), and the adapter wraps them in the MCP-required OAuth protocol shape.

How it works:

1. **Metadata** — generated from the `issuer` URL. Endpoint paths (`/oauth/authorize`, `/oauth/token`, `/oauth/revoke`) are appended to the issuer. The adapter does not perform OIDC discovery or fetch remote metadata.
2. **Authorization** — delegates entirely to your `authorize` callback. The raw `Request` is forwarded, so you can read query params (`redirect_uri`, `state`, `code_challenge`) and construct whatever login redirect you need.
3. **Token exchange** — if `exchangeCode` is provided, the adapter extracts the `code` from the POST body and calls your function. If `exchangeCode` is omitted, it returns a stub token (`"no-exchange-configured"`). This supports API-key-only auth where tokens are pre-shared and validation is the only real check.
4. **Token validation** — your `validateToken` callback receives the raw bearer token string and returns `{ userId }` or `null`. This is called on every authenticated MCP request.
5. **Revocation** — if `revokeToken` is provided, the adapter extracts the `token` from the POST body and calls your function. Otherwise, revocation is a no-op.

Token introspection pattern (for custom OAuth providers like Auth0 or Keycloak):

```typescript
import { oauth } from "@kitstack/sdk/server/auth";

const auth = oauth({
  issuer: "https://my-kit.example.com",
  authorize: async (req) => {
    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    return {
      redirect: `https://auth0.example.com/authorize?state=${state}&audience=my-kit`,
    };
  },
  exchangeCode: async (code) => {
    // Exchange code with Auth0's token endpoint
    const res = await fetch("https://auth0.example.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
      }),
    });
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  },
  validateToken: async (token) => {
    // Introspect the token with Auth0
    const res = await fetch("https://auth0.example.com/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return { userId: user.sub };
  },
});
```

### Monolith mode: serve({ kits: [...] })

Monolith mode runs multiple kits in a single MCP server process. Instead of `{ kit, db }`, you pass `{ kits, databases }`. This is useful for:

- Running all your kits behind a single endpoint (fewer ports, simpler deployment)
- Shared auth across kits (one adapter handles all)
- Internal tooling where kits are closely related

How it works internally:

1. **Tool namespacing** — each tool is prefixed with its kit ID to avoid collisions. A tool `create_contact` in kit `crm` becomes `crm/create_contact`. The MCP client sees all tools from all kits in a single `tools/list` response.
2. **View namespacing** — views are similarly prefixed. A view `pipeline` in kit `crm` becomes `crm/pipeline`.
3. **Per-kit databases** — the `databases` map is keyed by kit ID. Each kit's database config is looked up at startup. If a kit ID is missing from the map, `serve()` throws immediately with a clear error message.
4. **Handler merging** — internally, `serve()` merges all tools and views into a synthetic `KitDefinition` with id `"monolith"`, then creates a single `McpHandler`. The first kit's database is used as the handler's default DB.

```typescript
import { serve, kitstack } from "@kitstack/sdk/server";
import crmKit from "../kits/crm/kit.config";
import outreachKit from "../kits/outreach/kit.config";

serve({
  kits: [crmKit, outreachKit],
  databases: {
    crm: { url: process.env.CRM_DB! },
    "cold-outreach": { url: process.env.OUTREACH_DB! },
  },
  auth: kitstack({
    clientId: process.env.KITSTACK_CLIENT_ID!,
    clientSecret: process.env.KITSTACK_CLIENT_SECRET!,
  }),
  transport: "http",
  port: 3000,
});
```

### Gotchas

1. **Adapter selection: `none()` vs `kitstack()` vs `oauth()`.** Use `none()` only for local development — it accepts all tokens and returns a fixed user ID. For kits distributed through the KitStack marketplace, use `kitstack()` so users authenticate with their KitStack account. For fully self-hosted kits with independent user management, use `oauth()`.

2. **Metadata discovery is local, not remote.** Both `kitstack()` and `oauth()` construct their OAuth server metadata in-memory rather than fetching it from a `/.well-known/` endpoint. The adapter's `metadata()` method is synchronous and returns a static object. This means if the upstream provider changes its endpoint URLs, you need to update the adapter config (or the KitStack SDK version) — the adapter will not auto-discover changes.

3. **Token caching is the caller's responsibility.** Neither adapter caches validated tokens. Every MCP request triggers a call to `validate()`, which in turn makes an HTTP request (`GET /oauth/userinfo` for `kitstack()`, or your `validateToken` callback for `oauth()`). For high-throughput deployments, wrap your `validateToken` in a cache layer (e.g., an LRU cache with TTL matching your token expiry). The `kitstack()` adapter may gain built-in caching in a future release.

4. **Monolith mode uses the first kit's DB as the handler default.** While each kit's tools should use their own database connection, the `McpHandler` is initialized with the first kit's database. If a tool does not explicitly route to its kit's DB, it will fall back to this default. Ensure your kit tool handlers always use the correct connection.

5. **The `databases` map keys must match kit IDs exactly.** A kit with `id: "cold-outreach"` requires `databases["cold-outreach"]`, not `databases["coldOutreach"]` or `databases["outreach"]`. The error message on mismatch is immediate and clear, but it can be confusing if your kit IDs use hyphens while your env var names use underscores.

6. **`oauth()` without `exchangeCode` returns a stub token.** If you omit `exchangeCode`, the token endpoint returns `"no-exchange-configured"` as the access token. This is by design for API-key flows where `validateToken` is the only real auth check, but it means the MCP client will receive a meaningless token string. Your `validateToken` should handle this case (e.g., by checking the token against your own database rather than trying to introspect it with an upstream provider).
