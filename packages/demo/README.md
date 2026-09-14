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

For Claude, add a custom MCP connector pointing at the public HTTPS tunnel's
`/mcp` endpoint. The demo uses auth-none; expose it only through a temporary,
controlled tunnel and never use production data or real secrets. The external
smoke helper remains blocked until HTTPS/WSS and Claude MCP URLs are provided.

## Dogfood sequence

1. In Claude chat, call `prepare_debrief` with a concrete sales goal.
2. Call `/t/voice/start`, then `/t/voice/status`; the deterministic German
   interview reaches confirmation.
3. Mark the result partial, call `teach_from_correction`, then approve and
   publish the candidate through the demo harness.
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
