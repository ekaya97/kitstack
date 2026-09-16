# Sales debrief kit and host

`@kitstackco/debrief-kit` is the reference implementation of every KitStack
primitive: a kit with eight tools and three Views, a bounded `defineAgent`
loop, versioned instructions, structured memory, a persisted scheduler,
metadata-only telemetry, and a plugin-composed host with HTTP, stdio, and
WebSocket transports.

The kit owns sales behavior: tool schemas, agent policy, memory selection,
instructions, and transport-neutral channel and trigger contracts. The host
owns concrete providers: persistence, AI, telemetry, HTTP, Twilio, OpenAI
Realtime, and authentication, all registered as plugins. Another host can
replace those providers without touching the kit.

## The flow

One customer session crosses chat, scheduler, phone, confirmation, memory, and
observability:

```
prepared -> calling -> awaiting_confirmation -> confirmed
                                          \-> partial -> confirmed
any provider or start error -> failed
```

1. **Prebrief.** `prepare_debrief` takes `goal`, `company`, `contact_name`,
   `location`, `callback_at`, `callback_timezone`, and optional
   `buffer_minutes`. It upserts the customer, retrieves prior events and
   approved memories, resolves the instruction version, persists the session,
   schedules the call, and returns a compact prebrief with `session_id`,
   `customer_id`, `prebrief_ends_at`, `scheduled_call_at`, a masked
   destination, and a `kit_view("debrief", "prebrief")` hint.
2. **Wait.** The `prebrief` View shows customer, contact, location, last
   interaction, objective, countdown, and provider privacy status. No phone
   number, transcript, or audio.
3. **Call.** The poller claims the due job once, marks it `starting`, places
   the Twilio call with `Record=false`, and persists the call SID. A job stuck
   past its lease is surfaced as failed for operator action and never retried.
   The media stream is bridged to OpenAI Realtime under the `defineAgent`
   supervisor.
4. **Confirm.** `get_debrief_for_confirmation` opens the editable
   `confirmation` View. `update_debrief_draft` edits outcome, next step,
   customer update, discovered address, and follow-up date.
   `confirm_debrief_draft` writes immutable customer events; a second confirm
   returns the same event IDs.
5. **Timeline.** `customer-timeline` shows `prebrief`, `call_completed`,
   `address_discovered`, and `debrief_confirmed`, newest first, scoped to the
   customer and organization.
6. **Teach.** `teach_from_correction` creates a candidate memory linked to the
   session and instruction version. Approval and publication make it
   retrievable by the next prebrief for the same customer.

### Timing rule

`callback_at` is when the phone rings. `scheduled_call_at = callback_at +
buffer_minutes`. Time-only values resolve to the next occurrence in
`callback_timezone`, which is required. A time in the past or more than 24
hours ahead fails with an actionable error.

## Public surface

- `kit.config.ts` defines the `debrief` kit, its tools, and its Views.
- `createDebriefKit(handlers)` binds a host service to the tool contract.
- `createSalesAgent()` creates the bounded `defineAgent` loop.
- `createDebriefTools()`, `createDebriefToolHandlers()` adapt a host service
  implementing the `DebriefOperations` port.
- `createMemoryPolicy()`, `createVoiceChannel()`, and the trigger factories
  define kit-facing policy boundaries.

Tools: `prepare_debrief`, `get_session`, `get_debrief`,
`get_debrief_for_confirmation`, `update_debrief_draft`,
`confirm_debrief_draft`, `confirm_debrief`, `teach_from_correction`.

## Host composition

`src/composition/app/index.ts` is the concrete wiring for this repository. It
registers ten plugins and passes the same `DebriefCapabilities` to the kit:

| Kind | Plugin | Owns |
|---|---|---|
| persistence | libSQL | customers, sessions, events, drafts, memory, jobs, telemetry |
| kit | debrief | the kit definition as a plugin |
| memory | default | candidate, approved, published entries and retrieval |
| instructions | debrief-baseline | file-backed versioned instructions |
| ai | demo-compatible | text extraction and read-back through the proxy |
| http | demo-routes | the HTTP surface below |
| trigger | manual, twilio | trigger normalization into kit operations |
| channel | voice | turn source and output sink for the agent |
| proxy | openai-compatible | `/v1/chat/completions` with app identity and cost |
| scheduler | scheduled-calls | schedule, claim, complete, fail, with leases |

Every plugin invocation is recorded with latency and outcome, and the `/demo`
dashboard reads the registry descriptors and the event stream from the same
observability endpoint.

## HTTP surface

```
POST /mcp                        kit / kit_view over streamable HTTP
POST /t/voice/start              simulator call for a prepared session
POST /t/voice/status             simulator status
POST /t/voice/live/start         protected live start: confirmation + E.164 allowlist
WS   /t/voice/media              Twilio media stream: signature + signed session token
POST /v1/apps/register           developer app registration
GET  /v1/apps                    list registered apps
POST /v1/apps/:id/token          short-lived app JWT
POST /v1/chat/completions        OpenAI-compatible proxy, metered per app
GET  /api/demo/observability     events, aggregates, plugin descriptors, session traces
POST /api/demo/reset             clear sessions, memory, jobs, telemetry; keep apps
GET  /healthz
```

MCP auth has three explicit modes set by `KITSTACK_DEMO_MCP_AUTH`:

- `none`: loopback-only local development. Never a fallback.
- `app-token`: bearer app JWT; a separate admin token guards registration,
  token issuance, and reset.
- `internal-signed`: short-lived JWT from the KitStack router carrying
  `{ sub, org, kit, req, trace, exp }`, verified with a shared secret. This is
  the deployed mode; the presenter's Claude connector never sees this service
  directly.

## Privacy boundary

Twilio recording is off and provider retention is off by contract. The
telemetry record has no fields for prompts, completions, audio, transcripts,
tool arguments, or tool results, so nothing of that kind can be written even by
mistake. Phone numbers are masked in every response and absent from telemetry.
Memory holds structured facts and operator-entered corrections, never
conversation content.

## Development

```bash
  npm test               # 137 tests, fake providers, fake clock
npm run typecheck
npm start              # HTTP host on 127.0.0.1:3001
npm run start:stdio    # stdio transport for Claude Code or Desktop
npm run build          # kitstack build: tools, Views, shell
npm run publish:assets # upload shell, View modules, manifest, and bundle to the assets bucket
```

The router resolves the debrief shell from the fixed key
`apps/kits/debrief/shell.html`; the generated shell loads View assets from the
CDN origin the router supplies in MCP App CSP metadata.

## Status

Verified with fake providers and in the deployed stage: router discovery
through the existing Claude connector, all three View shells and loaders,
durable persistence across restart, scheduler idempotency across two pollers,
the two-run memory retrieval, and the `internal-signed` rollout.

Pending: a credentialed, allowlisted phone call through the deployed Twilio and
OpenAI Realtime path. The transport validates signatures, binds signed session
tokens, bridges G.711 μ-law 8 kHz media, and translates interruptions, and all
of that is covered by tests with fake sockets. It has not rung a phone from
this repository state, and unit tests are never promoted into a provider
smoke result.

`defineAgent` here is a bounded lifecycle supervisor around a provider-owned
Realtime connection: it receives content-free turn, interruption, stop, and
error events and enforces the instruction version, limits, cancellation, and
terminal result. It does not yet own every audio frame or Realtime
function-call event.
