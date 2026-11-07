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

1. **Register phone.** `register_phone` takes an E.164 number from an allowed
   country (DE, AT, CH). An SMS verification code is sent via Twilio Verify.
   `verify_phone` confirms the code. The number is stored encrypted and is
   never surfaced in a response. `get_phone` shows the masked number and
   verification status. `remove_phone` deletes it. Limit: 3 registration
   attempts per hour per user.
2. **Prepare debrief.** `prepare_debrief` takes `goal`, `company`,
   `contact_name`, `location`, `callback_at`, `callback_timezone`, optional
   `buffer_minutes`, and optional `prebrief_call_at`. It upserts the customer,
   retrieves prior events and approved memories, schedules the debrief call,
   and optionally schedules an earlier prebrief call. Returns a compact
   prebrief with `session_id`, `customer_id`, `scheduled_call_at`, and a
   `kit_view("debrief", "prebrief")` hint.
3. **Prebrief call (optional).** If `prebrief_call_at` is set, a voice call
   happens before the meeting. The agent greets the rep, gives a spoken summary
   of the customer and meeting, then asks the rep's plan and concerns.
   `save_meeting_plan` captures the rep's answer. No confirmation is needed
   after this call; it only prepares the rep for the meeting.
4. **Wait.** The `prebrief` View shows customer, contact, location, last
   interaction, objective, countdown, and provider privacy status. No phone
   number, transcript, or audio.
5. **Debrief call.** After the meeting, the poller claims the due job once,
   marks it `starting`, places the Twilio call with `Record=false`, and
   persists the call SID. A job stuck past its lease is surfaced as failed for
   operator action and never retried. The media stream is bridged to OpenAI
   Realtime under the `defineAgent` supervisor. If a prebrief call happened,
   the agent refers to the meeting plan.
6. **Confirm.** `get_debrief_for_confirmation` opens the editable
   `confirmation` View. The View shows previous debriefs for the same customer.
   `update_debrief_draft` edits outcome, next step, customer update, discovered
   address, and follow-up date. `confirm_debrief_draft` writes immutable
   customer events; a second confirm returns the same event IDs.
7. **Timeline.** `customer-timeline` shows `prebrief`, `call_completed`,
   `address_discovered`, and `debrief_confirmed`, newest first, scoped to the
   customer and organization.
8. **Teach.** `teach_from_correction` creates a candidate memory linked to the
   session and instruction version. Approval and publication make it
   retrievable by the next debrief for the same customer.

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

Tools: `register_phone`, `verify_phone`, `get_phone`, `remove_phone`,
`prepare_debrief`, `get_session`, `get_debrief`, `get_debrief_draft`,
`get_debrief_for_confirmation`, `update_debrief_draft`, `save_meeting_plan`,
`confirm_debrief_draft`, `confirm_debrief`, `teach_from_correction`.

## Guardrails

- **Allowed countries:** DE (+49), AT (+43), CH (+41) only; enforced at
  `register_phone` and re-checked at call time.
- **Verification rate limit:** 3 registration attempts per hour per user.
- **Daily call cap:** 5 scheduled calls per user in a rolling 24-hour window.
- **Call duration:** Hard limit of 10 minutes (600 seconds); Twilio ends the
  call automatically.
- **Fallback:** Prospects with no verified number cannot place calls. The
  operator org can use a legacy single-destination allowlist
  (`KITSTACK_DEMO_ALLOWED_DESTINATION`) while numbers roll out; prospects never
  fall back to it.

## Access and data separation

- Every signed-in user can use the debrief: the router runs with
  `KITSTACK_DEBRIEF_OPEN_ACCESS=true` (set in `infra/mcp.ts`). Without that
  flag, a tool call or View load needs a `kit:use` grant on kit `debrief`, and
  the user is told to ask the KitStack team for access. The web app never lets
  users activate this kit themselves.
- Spend is bounded by phone verification, 5 calls a day per user, and 20 calls
  a day across all organizations except `org-demo`
  (`KITSTACK_VOICE_SELF_SERVICE_DAILY_CALLS` in `voice.env` changes it).
- Operators are users holding `kit:admin` on organization `org-demo` (directly
  or through a team or role). They work in `org-demo`, the operator org.
- Everyone else works in a personal organization, `org-user-<userId>`. Each
  organization's customers, sessions, drafts, memories, phone numbers and
  telemetry are separate.
- This service accepts a router token for a personal org only for its own user.
  `KITSTACK_DEMO_INTERNAL_USER_ORG_ALLOWLIST` (deployed as `*=org-demo`) admits
  the router's operators to `org-demo`; an explicit `<userId>=<org>` entry
  takes precedence over `*`.
- Prebrief and debrief calls both ring the session owner's verified number.
  Only sessions in the operator org fall back to
  `KITSTACK_DEMO_ALLOWED_DESTINATION`; any other session without a usable
  number fails instead of calling someone else.

## Configuration

The service runs as a Docker container on a Hetzner box (Compose project
`/opt/kitstack/voice`, behind the box's Traefik). `scripts/deploy-voice.sh`
builds and restarts it for the current commit. Its environment is the
root-only file `/opt/kitstack/voice/voice.env` on the box; change it there and
run `docker compose up -d` in that directory. SST only owns the DNS records
(`KITSTACK_DEMO_VOICE_DOMAIN`, `KITSTACK_DEMO_VOICE_IPV4`/`IPV6` in
`.env.production`) and passes the URL to the router and the web app.

- `TWILIO_VERIFY_SERVICE_SID`: the Twilio Verify service used for SMS codes.
  When it is empty, `register_phone` and `verify_phone` fail with a clear error.
- Turn-taking overrides; unset values use the defaults in `packages/voice`:
  - `OPENAI_REALTIME_VAD_THRESHOLD`: how loud speech must be to count, 0–1.
    Default 0.55.
  - `OPENAI_REALTIME_SILENCE_MS`: the pause that ends the caller's turn before
    the agent answers. Default 420.
  - `OPENAI_REALTIME_PREFIX_PADDING_MS`: audio kept from just before speech was
    detected. Default 300.
  - `KITSTACK_VOICE_BARGE_IN_MS`: how long the caller must talk over the agent
    before it stops. Default: the silence duration plus 100 ms.

## Deploy prerequisites

1. Create a Twilio Verify service (Twilio Console → Verify → Services) and set
   `TWILIO_VERIFY_SERVICE_SID` in `voice.env` to its SID (it starts with `VA`).
2. Grant the operator `kit:admin` on organization `org-demo`. Without it the
   operator works in a personal organization and does not see the demo data.

## Host composition

`src/composition/app/index.ts` is the concrete wiring for this repository. It
registers ten plugins and passes the same `DebriefCapabilities` to the kit:

| Kind | Plugin | Owns |
|---|---|---|
| persistence | libSQL | customers, sessions, events, drafts, memory, jobs, telemetry |

Storage is host-bound through the SDK's provider-neutral `ctx.storage` seam.
The kit includes `createLibsqlStorageAdapter` as its first adapter; it owns
only the scoped object table and the SQL contract. The existing debrief domain
persistence is wired through that adapter, while the legacy `ctx.db` path is
kept for compatibility with the other maintained kits.
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

### Local microphone voice

To exercise the real `defineAgent` voice loop without Twilio, start the local
host with a server-side OpenAI key:

```bash
OPENAI_API_KEY=... OPENAI_REALTIME_MODEL=gpt-realtime \
  npm start --workspace @kitstackco/debrief-kit
```

Open `http://127.0.0.1:3001/t/voice/local`, prepare a debrief through MCP,
paste its `session_id` into the page, and select **Start local call**. The page
captures microphone audio, sends G.711 μ-law frames through the loopback media
adapter, and plays the Realtime audio response. The adapter uses the same
signed session binding, instruction/memory context, `defineAgent` supervisor,
debrief persistence, and telemetry path as the Twilio bridge; only the audio
transport is different. During the call, the agent can call
`get_debrief_draft` and `update_debrief_draft` to write explicitly stated facts
to the provisional draft. Stop the call before using the confirmation View;
confirmation remains an operator action and is what creates immutable customer
events.

The API key remains server-side. Recording, retention, audio bodies, and
transcripts are not persisted. This is a local voice rehearsal, not evidence
that a phone call can be placed through Twilio.

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
