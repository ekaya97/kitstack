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
- **`default.ts`** — `$default` route. Receives responses from the CLI (JSON `{ requestId, result }`) and stores them in OAuthStore with a 60-second TTL for the McpRouter relay route to poll.
- **`disconnect.ts`** — `$disconnect` route. Best-effort cleanup. Since `$disconnect` does not guarantee query params, stale sessions rely on the 24-hour TTL for cleanup. A GSI on connectionId would make this more efficient but is not needed at the current scale (max 2 sessions per user).

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

### Response storage with short TTL

The `$default` handler stores responses with a 60-second TTL. This is intentionally short because responses are only needed until the McpRouter relay route polls for them. If a response is not picked up within 60 seconds, the original HTTP request to the McpRouter will have already timed out (API Gateway has a 29-second timeout). The short TTL prevents DynamoDB from accumulating stale response data.

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
