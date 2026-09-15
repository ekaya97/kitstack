# KitStack sales voice demo

This is an unreleased, local-first sales voice agent demo. It is not a
production deployment. The simulator is the default voice provider, so the
demo runs without Twilio, OpenAI Realtime, or a public tunnel.

## Run locally

```sh
npm run demo:server
```

The server listens on `http://127.0.0.1:3001`. Start the developer proof
surface in a second terminal:

```sh
npm run dev --workspace kitstack-web
```

Open `/demo` in the web app. Set `NEXT_PUBLIC_DEMO_API_URL` when the server is
not on the default port. The demo database defaults to `.kitstack/demo.db`.

For a local process MCP client, use the standard stdio harness instead of the
HTTP server:

```sh
npm run start:stdio --workspace @kitstackco/demo
```

It reads one JSON-RPC message per line from stdin and writes only JSON-RPC
responses to stdout. The supported lifecycle is `initialize`,
`notifications/initialized`, `ping`, `tools/list`, and `tools/call`. Example
Claude Desktop/Code-style configuration:

```json
{
  "mcpServers": {
    "kitstack-demo": {
      "command": "npm",
      "args": ["run", "start:stdio", "--workspace", "@kitstackco/demo"],
      "cwd": "/Users/eneskaya/dev/kitstack"
    }
  }
}
```

The process uses the same `DemoApp` debrief, instruction, memory, telemetry,
and simulator services as the HTTP demo route. A supplied app/runtime remains
the test seam; no auth behavior is changed by this adapter.

For Claude, add a custom MCP connector pointing at the public HTTPS tunnel's
`/mcp` endpoint. Local HTTP defaults to auth-none. Before exposing a tunnel,
use the explicit app-token gate:

```sh
KITSTACK_DEMO_MCP_AUTH=app-token \
KITSTACK_DEMO_ADMIN_TOKEN='set-a-long-random-demo-token' \
npm run demo:server
```

Set the same value as `NEXT_PUBLIC_DEMO_ADMIN_TOKEN` for the local `/demo`
operator surface. Register an app and issue its short-lived token from `/demo`,
then configure that bearer token on the connector. Auth-none is for loopback
only; never expose the unauthenticated mode through a public tunnel or use
production data/secrets.
The external smoke helper remains blocked until HTTPS/WSS and Claude MCP URLs
are provided.

## Dogfood sequence

1. In Claude chat, call `prepare_debrief` with a concrete sales goal.
2. Call `/t/voice/start`, then `/t/voice/status`; the deterministic German
   interview reaches confirmation.
3. Mark the result partial, call `teach_from_correction`, then call
   `approve_memory` and `publish_memory` for the returned memory ID.
4. Prepare a second debrief. Its memory IDs show the approved correction from
   run 1; complete and confirm the second call.
5. Use `/demo` Usage and Session Trace to inspect app identity, token events,
   cost, latency, instruction version, memory IDs, and parent/trace IDs.
6. Reset with the demo control or `POST /api/demo/reset` using the demo reset
   token. Sessions, memory, and telemetry clear; app registrations and tokens
   remain.

## Storage and privacy boundary

The package owns the unreleased sales-agent demo runtime boundary. The
telemetry store uses `@libsql/client` directly and defaults to
`.kitstack/demo.db`; it does not add a SQLite dependency to the SDK and must
not reuse `databases/local.db`.

`src/telemetry` is a metadata-only contract. Events contain identity, channel,
session/tree linkage, operation, model usage, latency, cost, outcome, and
references to memory/instruction versions. The store explicitly inserts only
those columns, so prompts, completions, audio, transcripts, and tool payloads
are not retained.

Use `:memory:` clients in unit tests and `createTelemetryStore({ dbPath })` for
a persistent local demo store. `sequence` is monotonic and query results are
ordered by it, which keeps parent events before their appended children even
when timestamps are equal or arrive out of order.
