# CLI Auth & Relay Client — Dev Notes

Tickets: T-0053, T-0054, T-0055, T-0056, T-0057

## What was built

### Browser OAuth login flow (`kitstack login`)

`packages/sdk/src/cli/commands/login.ts` implements a full browser-based OAuth flow for the KitStack CLI:

1. A temporary HTTP server starts on `127.0.0.1:9876` (falls back to a random port via `server.listen(0)` if 9876 is in use).
2. The CLI opens the user's browser to `https://kitstack.co/cli/authorize?callback=http://localhost:{port}` (override with `KITSTACK_AUTH_URL` env var for local dev).
3. The `/cli/authorize` page checks the BetterAuth session (redirects to `/login` if needed).
4. User clicks "Authorize" → `POST /api/cli/token` creates a BetterAuth session in Turso with `userAgent: "kitstack-cli"` and 1-year expiry.
5. The page redirects to the localhost callback with `?token={sessionToken}&email=...`.
6. The CLI saves the credentials and shuts down the callback server.

The login command times out after 2 minutes if no callback is received. It is idempotent — if credentials already exist, it prints a message and exits unless `--force` is passed.

### Token storage (`credentials.ts`)

`packages/sdk/src/cli/credentials.ts` manages the credential file at `~/.kitstack/credentials.json`. Three functions are exported:

| Function | Purpose |
|----------|---------|
| `loadCredentials()` | Read and parse the JSON file; returns `null` if missing or malformed |
| `saveCredentials(creds)` | Write credentials with `0600` permissions (creates `~/.kitstack/` if needed) |
| `clearCredentials()` | Overwrites the file with `{}` (for future `kitstack logout`) |

The `Credentials` interface contains three fields: `token` (string, BetterAuth session token), `email` (string), and `authenticatedAt` (ISO 8601 timestamp).

### WebSocket relay client (`relay-client.ts`)

`packages/sdk/src/runtime/relay-client.ts` connects to the DevRelay WebSocket API Gateway. This enables `kitstack dev` to serve MCP requests through a public URL without the developer exposing ports or configuring tunnels.

The flow:

```
Claude Desktop / LLM client
  → HTTPS POST to https://mcp.kitstack.co/dev/{sessionId}
  → McpRouter stores the request and sends it via WebSocket to the CLI
  → relay-client receives the WS message, dispatches to MCP handler
  → relay-client sends the response back via WebSocket
  → McpRouter relay route polls for the response and returns it to the client
```

The `connectRelay()` function returns `Promise<never>` — it runs until the process exits.

### Server-side relay handlers (in `packages/mcp-server/src/relay/`)

Three Lambda handlers back the WebSocket API Gateway:

- **`connect.ts`** — `$connect` route. Validates the CLI token against the BetterAuth `session` table in Turso (checks token exists and is not expired), then stores the WebSocket connectionId keyed by sessionId in DynamoDB with a 24-hour TTL.
- **`default.ts`** — `$default` route. Receives responses from the CLI (JSON `{ requestId, result }`) and stores them in **DevRelayStore** (a separate DynamoDB table) with a 5-minute TTL for the McpRouter relay route to poll.
- **`disconnect.ts`** — `$disconnect` route. No-op — relies on TTL for cleanup (5 minutes for relay data in DevRelayStore, 24 hours for sessions in MCPAuthStore).

### View asset relay with hybrid CDN loading (T-0085)

The relay client also handles **view asset requests**. When the kit has views, `kitstack dev` starts a local Vite dev server alongside the relay connection. The McpRouter has a `GET /dev/{sessionId}/**` route that forwards asset requests to the CLI via WebSocket, and the CLI fetches from the local Vite dev server.

**The problem:** React/ReactDOM is ~192KB when served by Vite. Vite's HMR client (`@vite/client`) is ~136KB. API Gateway WebSocket has a 128KB message limit. Sending either through the relay crashes the connection.

**The solution: hybrid CDN + relay with shim modules.** React loads from CDN vendor.js via tiny shim modules. Kit-specific files (view modules, CSS) load through the relay. Large Vite internals are stubbed out.

| Asset | Source | Size | How |
|-------|--------|------|-----|
| `vendor.js` (React+ReactDOM) | CDN | 192KB | Loaded by shim modules; never goes through WebSocket |
| `shared.js` (SDK hooks) | CDN | 2KB | Never changes during dev |
| `pipeline.tsx` (view entry) | Relay → Vite | 3-4KB | Changes during dev |
| `View.tsx` (component) | Relay → Vite | 3-20KB | Changes during dev |
| CSS (Vite JS module) | Relay → Vite | ~22KB | Vite serves CSS as JS; calls `updateStyle()` |
| `react.js` (Vite pre-bundled) | Shim (inline) | ~400B | Relay intercepts, returns shim that re-exports from CDN vendor.js |
| `react-dom_client.js` | Shim (inline) | ~150B | Same shim approach |
| `react_jsx-runtime.js` | Shim (inline) | ~150B | Same shim approach |
| `@vite/client` (HMR runtime) | Stub (inline) | ~300B | No-op stub with functional `updateStyle()` for CSS injection |

**Three interception layers in the relay client** (`relay-client.ts`):

1. **`@vite/client` stub:** Vite's HMR runtime is ~136KB and useless through the relay (no push connection). The relay returns a no-op stub that exports functional `updateStyle(id, css)` (injects `<style>` tags) so CSS modules work, but skips all HMR machinery.

2. **React/ReactDOM shim modules:** When the browser requests `react.js`, `react-dom_client.js`, or `react_jsx-runtime.js` from Vite's pre-bundled deps, the relay returns a tiny shim instead of fetching the real 188KB file. The shim imports from CDN vendor.js and re-exports with standard names:

```javascript
// Shim for react.js (~400 bytes, served inline by relay client):
import { reactExports as m } from "https://cdn/.../vendor.js";
export default m;
export const { useState, useEffect, useCallback, useMemo, useRef,
  useContext, createContext, createElement, Fragment, forwardRef,
  memo, lazy, Suspense, Children, ... } = m;

// Shim for react-dom_client.js:
import { clientExports as m } from "https://cdn/.../vendor.js";
export default m;
export const { createRoot, hydrateRoot } = m;

// Shim for react_jsx-runtime.js:
import { jsxRuntimeExports as m } from "https://cdn/.../vendor.js";
export default m;
export const { jsx, jsxs, Fragment } = m;
```

The shims bridge vendor.js's namespace exports (`reactExports`, `clientExports`, `jsxRuntimeExports`) to the individual named exports that Vite consumers expect (`useState`, `createRoot`, `jsx`, etc.).

3. **Import path rewriting:** All remaining absolute imports in JS files get prefixed with `/dev/{sessionId}/` so they route through the relay (e.g. `/src/views/pipeline/View.tsx` → `/dev/67c99a1f/src/views/pipeline/View.tsx`).

4. **Size guard:** Before sending any asset response, the relay checks the JSON-serialized payload size. If over 120KB (safety margin below the 128KB limit), it returns a 413 error with the file path and size instead of crashing the WebSocket.

**Build requirements:**

- **`minifyInternalExports: false`** in the Rollup output config — preserves vendor.js export names as `reactExports`, `clientExports`, `jsxRuntimeExports` instead of minified single letters. The shim modules depend on these names.
- **`_vendor_reexports.ts` entry** — forces ALL React exports into vendor.js, not just the ones used by current view components. This ensures any `import { X } from "react"` in a dev View.tsx works even if X wasn't in the last build.
- **`esbuild: { jsxDev: false }`** in the Vite config — forces production JSX runtime (`jsx`/`jsxs` from `react/jsx-runtime`) instead of dev-only `jsxDEV` from `react/jsx-dev-runtime`, matching what vendor.js provides.

**CSP handling:** The `kit_view` response includes CSP domains for both the relay origin (McpRouter domain) and the CDN domain (`platformCdn`). This is already handled in `handleKitView` in `mcp-handler.ts` — when `devAssetBaseUrl` is set, the CSP includes the relay origin; `platformCdn` and `kitCdn` are always included when set.

**Dev shell:** When `devAssetBaseUrl` is configured, `kit_view` returns the `generateDevRelayShell` HTML instead of the production shell. This shell loads view modules from the relay URL. The view modules import React through shims, which load vendor.js from CDN.

**Live reload workflow (not push-based HMR):** There is no WebSocket push from Vite to the Claude.ai iframe. Instead, each `kit_view` call fetches the latest module from Vite in real-time. The developer edits `View.tsx`, then asks Claude to "show the pipeline view again" — the fresh code appears immediately without rebuild or deploy.

## What was learned

### Localhost callback server gotchas

The callback server binds to `127.0.0.1` (not `0.0.0.0`) to avoid firewall prompts on macOS. Port 9876 was chosen as a default because it is above the ephemeral port range on most systems but below the common dev-server ports (3000, 5173, 8080). When port 9876 is occupied, the server's `EADDRINUSE` handler calls `server.listen(0)` to get a random available port. The browser URL is constructed after the server is listening, so the callback URL always matches the actual port.

One subtlety: the callback server must respond with HTML (not a redirect or 204) because it is rendering the "Authenticated!" confirmation page directly in the browser tab. A redirect would require hosting a page on kitstack.co, adding a round trip.

### Unified auth with BetterAuth

CLI tokens are standard BetterAuth session tokens — the same format used by the web app. There is no separate `kst_` token format or custom token storage. The `/api/cli/token` endpoint creates a BetterAuth session row in Turso's `session` table with `userAgent: "kitstack-cli"` and a 1-year expiry.

The relay `$connect` handler validates tokens by querying the `session` table directly (checking token exists and `expires_at > now()`). This means CLI sessions can be revoked from the web app's session management UI, and there's a single source of truth for all authentication.

The web app routes involved:
- `web/src/app/cli/authorize/page.tsx` — client-side page that checks BetterAuth session, shows "Authorize" button
- `web/src/app/api/cli/token/route.ts` — creates the session, validates callback is localhost

### WebSocket reconnection with exponential backoff

The relay client uses exponential backoff starting at 1 second, doubling on each failure, capped at 30 seconds:

```
Attempt 1: 1s delay
Attempt 2: 2s delay
Attempt 3: 4s delay
Attempt 4: 8s delay
Attempt 5: 16s delay
Attempt 6+: 30s delay (cap)
```

The backoff resets to 1 second on a successful `open` event. The `error` event handler is intentionally empty because every WebSocket error is followed by a `close` event, which is where the reconnect logic lives. Handling both would cause double reconnects.

The `connectRelay()` function returns `Promise<never>` via `new Promise(() => {})` — this keeps the Node.js event loop alive without requiring a `setInterval` keepalive. The WebSocket itself keeps the process running, and the never-resolving promise ensures the calling `await` blocks forever.

### Relay vs stdio tradeoffs

| | stdio mode | relay mode |
|---|---|---|
| **Setup** | Edit Claude Desktop config JSON | Run `kitstack login` once, then `kitstack dev --relay` |
| **Latency** | Lowest (direct pipes) | ~100-200ms overhead (WS round trip through API Gateway + DynamoDB poll) |
| **Restartability** | Must restart Claude Desktop on CLI restart | CLI reconnects automatically; Claude Desktop keeps the same URL |
| **Firewall** | No network needed | Requires outbound WSS to relay.kitstack.co |
| **Multiple clients** | One client per process | Any client with the session URL can connect |
| **Use case** | Local development with Claude Desktop | Remote development, team sharing, non-Desktop clients |

stdio mode remains the primary development mode. Relay is useful when the developer cannot configure stdio directly (e.g., using a web-based LLM client) or wants to share a dev session.

### Response storage in DevRelayStore

Relay responses are stored in a dedicated **DevRelayStore** DynamoDB table (separate from MCPAuthStore which handles OAuth/sessions). The `$default` handler stores responses with a 5-minute TTL. The McpRouter relay route polls DevRelayStore with `ConsistentRead: true` at 200ms intervals (max 5 seconds) for the response. In practice, the CLI responds in <100ms so it's usually 1-2 reads.

The 5-minute TTL is generous — responses are typically consumed within seconds. The TTL just ensures stale data is cleaned up if the McpRouter times out or the response is never read.

### Deterministic session IDs

Session IDs are derived from a SHA-256 hash of the user's email (first 8 hex chars). This means the same developer always gets the same relay URL — no need to re-add the MCP connection in Claude.ai after restarting `kitstack dev`.

### DynamoDB table separation

Two DynamoDB tables are used for relay:

| Table | Purpose | TTL |
|-------|---------|-----|
| **MCPAuthStore** | Dev sessions (`DEV_SESSION#`), OAuth clients, refresh tokens, rate limits | Per-item (24h sessions) |
| **DevRelayStore** | Relay request/response mailbox (`REQ#`) | 5 minutes |

This separation keeps transient relay data out of the auth store.

## How to use it

### Login workflow

```bash
# First-time login
npx kitstack login
# → Opens browser to kitstack.co/cli/authorize
# → User authenticates and clicks "Authorize"
# → Terminal prints: "Authenticated as dev@example.com"
# → Token saved to ~/.kitstack/credentials.json

# Check current credentials
cat ~/.kitstack/credentials.json
# { "token": "abc123...", "email": "dev@example.com", "authenticatedAt": "2026-04-25T..." }

# Re-authenticate (e.g., different account)
npx kitstack login --force

# Override the auth URL (for staging/local development)
KITSTACK_AUTH_URL=http://localhost:3000/cli/authorize npx kitstack login
```

### Dev server in relay mode

```bash
# Start the dev server in relay mode (requires login first)
npx kitstack dev --relay

# Output:
#   Relay connected. Session URL:
#   https://mcp.kitstack.co/dev/abc123
#
#   Configure your LLM client to use this URL as the MCP server endpoint.
```

### Claude Desktop config for relay mode

When using relay mode, the Claude Desktop config points to the public relay URL instead of a local stdio process:

```json
{
  "mcpServers": {
    "my-kit": {
      "url": "https://mcp.kitstack.co/dev/{sessionId}"
    }
  }
}
```

For stdio mode (the default/primary development mode), the config uses the local process:

```json
{
  "mcpServers": {
    "my-kit": {
      "command": "npx",
      "args": ["tsx", "packages/sdk/src/cli/index.ts", "dev", "--stdio"],
      "cwd": "/path/to/kits/my-kit"
    }
  }
}
```

### Live view development via relay (T-0085)

Requires a prior `kitstack build && kitstack deploy` to put vendor.js (with preserved export names) on CDN.

```bash
# Start dev server in relay mode with CDN URLs
KITSTACK_RELAY_URL=wss://mz6owqkcwd.execute-api.eu-central-1.amazonaws.com/\$default \
KITSTACK_MCP_URL=https://d334d0ihf1hsg4.cloudfront.net \
KITSTACK_CDN=https://d3m7hzbfloe6y2.cloudfront.net/apps/kits/crm \
KITSTACK_KIT_CDN=https://d3m7hzbfloe6y2.cloudfront.net/apps/kits/crm/crm \
npx tsx packages/sdk/src/cli/index.ts dev --config kits/crm/kit.config.ts
```

Then in Claude.ai:
1. Add MCP server at `https://d334d0ihf1hsg4.cloudfront.net/dev/{sessionId}`
2. Ask: "show me the pipeline view" — view renders with data from local DB
3. Edit `kits/crm/src/views/pipeline/View.tsx` — change visible text
4. Ask: "show pipeline again" — updated code appears (Vite serves fresh module)

No rebuild/deploy needed between edits. The relay fetches from Vite on every request.

### Programmatic usage of the relay client

```typescript
import { connectRelay } from "@kitstack/sdk/runtime/relay-client";
import { loadCredentials } from "@kitstack/sdk/cli/credentials";

const creds = loadCredentials();
if (!creds) {
  console.error("Not logged in. Run: kitstack login");
  process.exit(1);
}

await connectRelay({
  sessionId: crypto.randomUUID(),
  token: creds.token,
  handler: myMcpHandler,
  onReady: () => console.log("Relay connected"),
  onDisconnect: () => console.log("Relay disconnected, reconnecting..."),
});
```
