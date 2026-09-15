# KitStack sales voice demo

This is an unreleased, local-first sales voice agent demo. It is not a
production deployment. The simulator is the default voice provider, so the
demo runs without Twilio, OpenAI Realtime, or a public tunnel.

The verified local path is the deterministic German simulator plus the
KitStack `/demo` control plane. The server also composes the Twilio/OpenAI
Realtime transport and bounded `defineAgent v1` supervisor when all live-call
environment variables are present. Composition and fake-provider tests pass;
no credentialed phone smoke has passed yet. T-0165 remains open for that
external gate.

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

The `/demo` page is the KitStack control-plane dashboard for this unreleased
demo. Use `Overview` for presenter metrics, `Apps` for registration and token
issuance, `Usage` for per-app cost/latency/outcomes, and `Session Trace` for
the prebrief → voice → feedback event chain. It refreshes automatically while
Claude is calling the MCP tools. The authenticated product dashboard links to
this surface as `Demo control plane`; the older marketplace/admin dashboards
are not wired to this local telemetry store.

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

The repository also includes the equivalent `.mcp.json` registration for
Claude Code-style local discovery.

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

## AWS demo deployment

The demo can run as a single SST-managed ECS/Fargate service. This is a demo
environment, not a production deployment: the service is deliberately pinned
to one task so its in-process session state remains coherent across the
prebrief, phone call, and debrief sequence. Telemetry and memory use the
configured remote libSQL/Turso database.

Set the service domain before deploying if you want real Twilio calls. The
domain must be hosted in Route 53 (or replace the SST domain configuration
with an externally managed ACM certificate/DNS record):

```sh
export KITSTACK_DEMO_VOICE_DOMAIN=voice.example.com
sst secret set TursoDbUrl 'libsql://your-db.turso.io'
sst secret set TursoAuthToken 'your-turso-token'
sst secret set DemoAdminToken 'use-a-long-random-operator-token'
sst secret set DemoAllowedDestination '+491234567890'
sst secret set TwilioAccountSid 'AC...'
sst secret set TwilioAuthToken '...'
sst secret set TwilioFromNumber '+49...'
sst secret set OpenAiApiKey 'sk-...'
npx sst deploy --stage demo
```

The deployment prints the `DemoVoice` URL. Set
`KITSTACK_DEMO_VOICE_DOMAIN` consistently for later deploys; it becomes the
HTTPS/WSS origin used in TwiML and Twilio signature validation. The `/demo`
dashboard is wired to the service URL by SST and receives the operator token
as a build-time public demo value. Keep this environment access-controlled.

Without the provider secrets or voice domain, the service still deploys and
the deterministic simulator remains available. The live-call capability stays
disabled until all provider settings and public HTTPS/WSS settings are
present. Verify `GET /healthz` before opening `/demo`.

## Real phone path: T-0165 target configuration

This is the operator contract for the composed live path. Do not expose a
tunnel or place a call without the required provider credentials, an
allowlisted destination, and the protected dashboard confirmation.

Required external prerequisites:

- a Twilio account with outbound voice enabled and a verified/from phone
  number;
- an OpenAI API key with access to the selected Realtime model;
- a public HTTPS/WSS tunnel that routes `/mcp` and `/t/voice/media` to the
  same local process; and
- one operator-owned, allowlisted E.164 destination number.

The planned environment contract is:

```sh
export KITSTACK_DEMO_MCP_AUTH=app-token
export KITSTACK_DEMO_ADMIN_TOKEN='use-a-long-random-local-token'
export TWILIO_ACCOUNT_SID='AC...'
export TWILIO_AUTH_TOKEN='do-not-commit-this'
export TWILIO_FROM_NUMBER='+49...'
export OPENAI_API_KEY='do-not-commit-this'
export OPENAI_REALTIME_MODEL='gpt-realtime'
export KITSTACK_DEMO_PUBLIC_HTTPS_URL='https://your-tunnel.example'
export KITSTACK_DEMO_PUBLIC_WSS_URL='wss://your-tunnel.example/t/voice/media'
export KITSTACK_DEMO_ALLOWED_DESTINATION='+49...'

npm run demo:server
```

Run the web control plane separately, set
`NEXT_PUBLIC_DEMO_API_URL=http://127.0.0.1:3001`, and set
`NEXT_PUBLIC_DEMO_ADMIN_TOKEN` to the same local admin token. The live-call
control remains disabled unless all provider settings are present. Prepare the
session in Claude first, confirm the allowlisted number
explicitly in `/demo`, then start one short call. Verify the session in
Overview, Usage, and Session Trace. A provider failure is recorded as an
unverified smoke failure; it is not hidden behind the simulator result.

The live voice boundary must keep Twilio recording disabled, avoid provider
retention, redact phone numbers from telemetry, and persist only metadata such
as session/call identifiers, status, latency, usage, cost, instruction version,
and memory references. The current `defineAgent v1` boundary supervises the
bounded lifecycle while OpenAI Realtime owns audio/model turn generation; it
is not a stream-native audio/tool orchestration contract.

## Dogfood sequence

For the shortest presenter path:

1. Start the demo server and web app in separate terminals, then open `/demo`.
2. In `Apps`, register `Sales voice demo` and issue its token. Keep the token
   masked in the dashboard until it is needed by the MCP connector.
3. Switch to `Overview`, keep it visible, and run the MCP sequence in Claude.
   The dashboard updates every five seconds; use `Refresh` immediately after
   a tool call if needed.
4. In Claude chat, call `prepare_debrief` with a concrete sales goal.
5. Call `/t/voice/start`, then `/t/voice/status`; the deterministic German
   interview reaches confirmation.
6. Mark the result partial, call `teach_from_correction`, then call
   `approve_memory` and `publish_memory` for the returned memory ID.
7. Prepare a second debrief. Its memory IDs show the approved correction from
   run 1; complete and confirm the second call.
8. Use `/demo` Usage and Session Trace to inspect app identity, token events,
   cost, latency, instruction version, memory IDs, and parent/trace IDs.
9. Reset with the demo control or `POST /api/demo/reset` using the demo reset
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
