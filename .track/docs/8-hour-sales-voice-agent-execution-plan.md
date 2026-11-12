# KitStack — 8-Hour Sales Voice Agent Execution Plan

**Status:** execution plan  
**Date:** 14 September 2026  
**Scope:** unreleased prototype; new product identity  
**Target:** one working demo after roughly eight hours of agentic coding

## Status model

This document separates implementation status from target status:

- **Implemented and locally verified:** the deterministic simulator path, MCP
  debrief workflow, memory/instruction feedback loop, proxy, metadata-only
  telemetry, app registration/token issuance, and KitStack `/demo` dashboards.
- **Implemented and locally composed:** the bounded SDK `defineAgent v1`
  primitive, Twilio Calls/TwiML/media-stream transport, protected live-call
  route, WebSocket upgrade mounting, provider/session wiring, and dashboard
  live-call controls. Fake-provider and loopback tests cover the composition.
- **Implemented and locally integrated:** the demo host dispatches persistence,
  memory, instructions, debrief-kit, AI, HTTP, trigger, voice-channel, and
  proxy work through registered plugins. Plugin invocation latency/outcome is
  recorded as metadata-only telemetry, and the observability API returns the
  registered plugin descriptors for the Plugins dashboard.
- **Not yet complete:** credentialed Twilio/OpenAI/public-WSS phone smoke. No
  provider smoke is claimed until that gate passes with operator-supplied
  credentials and an allowlisted test number.
- **Target:** a repeatable local-first demo in which the simulator is the
  deterministic fallback and, when external prerequisites are present, the
  same prepared debrief can place one short real call and show the result in
  the same dashboards.

## Execution log

- `T-0142` checkpointed the previously untracked `kits/adint` and
  `kits/fressnapf` work on `demo-sales-voice-agent`.
- `T-0143` removed only the ignored, unreferenced `deprecated/` tree.
- `T-0144` landed metadata-only telemetry and the dedicated libSQL store in
  `0e604d6`; its focused gate passed 7/7 tests and TypeScript.
- `T-0145` landed the five-registration plugin registry in `af84e23`; its
  focused gate passed 7/7 tests.
- `T-0149` landed isolated app JWTs and the load-bearing inference proxy in
  `13d7ff0`; its focused auth/proxy gate passed 8/8 tests.
- `T-0146` landed the framework-neutral runtime/HTTP boundary in `7722ce8`;
  the combined demo gate passed 31/31 tests and TypeScript. `/mcp` remains a
  deliberate 501 placeholder until the debrief path wires it.
- `T-0147` landed structured replayable memory in `8e38d1b` and `T-0148`
  landed file-backed versioned instructions in `ab7c357`; the combined demo
  gate passed 45/45 tests and TypeScript.
- `T-0150` landed the specialized debrief service in `eaadd25` and the
  `kits/debrief` SDK definition in `4d5e5b5`; the combined demo gate passed
  48/48 tests and TypeScript. The run-1 approval → run-2 retrieval behavior
  is covered before voice integration.
- `T-0151` is now complete in `43a2122`, `f2f6d3f`, and `5ff97ab`; the
  independent demo gate passed 60/60 tests and TypeScript. The simulator is
  the default, privacy settings are explicitly off, and external smoke stays
  blocked until real HTTPS/WSS/Claude connectivity is supplied.
- `T-0153` composed the local services, mounted the simulator route surface,
  and completed the two-run dogfood scenario. The branch is
  `demo-sales-voice-agent`; the environment exposes one shared worktree, so
  implementers are constrained to disjoint directories and commits are
  reviewed between slices.
- `T-0153A` composition landed in `66de968`; PM verification passed 61/61
  demo tests and TypeScript. It now shares one libSQL client and reset clears
  sessions/memory/telemetry while preserving app credentials.
- `T-0153B` was the route/MCP integration subtask; its acceptance gate
  exercised Claude-compatible `tools/list`, proxy identity/cost, and reset
  repeatability.
- `T-0153` completed in `2bcd6a9` and `fdedf16`; PM route dogfood passed with
  both runs using MCP/voice/observability paths.
- `T-0154` completed in `8ccf48b` and `b024410`; elevated real-TCP checks and
  live local curls passed for MCP discovery and observability.
- `T-0152` completed in `94064f1` and `55d4c59`; focused web checks passed
  2/2. Full web TypeScript remains noisy from pre-existing `.next`/SST/resource
  errors documented in the ticket.
- `T-0155` completed in `50a2032`, `ea5fb16`, and `88dfef5`; the demo MCP
  boundary now supports explicit `none` or `app-token` modes. App-token mode
  rejects unauthenticated MCP requests and requires a separate admin token for
  app registration, token issuance, and reset. The UI and runbook document the
  controlled-tunnel setup.
- `T-0156` completed in `de78384`; the process-based stdio harness supports
  `initialize`, `notifications/initialized`, `ping`, `tools/list`, and
  `tools/call` against the same demo services as HTTP.
- `T-0157` completed in `77b28a1`; approval and publication are now callable
  through `approve_memory` and `publish_memory`, preserving session/org/kit
  isolation.
- `T-0158` completed in `627bc35`; the automated two-run dogfood gate now
  executes the correction-to-published-memory loop through MCP tools and checks
  proxy, observability, trace, and reset behavior.
- The web gate is now reproducible from the workspace: `web/package.json`
  exposes `npm test` and `web/vitest.config.ts` scopes Vitest to the web
  package. The focused demo-page gate passes 2/2.
- Follow-up tickets `T-0159` (Claude/tunnel rehearsal) and `T-0160` (Entra ID
  federation for MCP OAuth) are intentionally backlog items. They are not
  required for the local simulator demo and require external
  credentials/connectivity. Live-provider smoke is now tracked by T-0165.
- `T-0162` was the prerequisite for the real phone path: it added the bounded
  `defineAgent v1` primitive and the debrief voice adapter. The simulator
  remains available as a provider fixture, but explicit MCP calls must not be
  the production-shaped orchestration path for a live call.
- `T-0162` landed the bounded SDK primitive in `31b80af`; its focused tests
  pass. The demo adapter is present, but its semantics are a bounded lifecycle
  supervisor around provider-owned realtime audio/model turns, not a
  stream-native agent connector.
- `T-0163` landed the Twilio/OpenAI Realtime transport in `10c815e`;
  its focused tests pass. The module validates E.164 values and Twilio
  signatures, uses signed session claims, bridges G.711 μ-law 8 kHz media,
  and disables recording/retention. T-0165 now mounts it in the demo server;
  it has not placed a credentialed call.
- `T-0164` landed the protected-dashboard/live-call UI seam in `b63b111`;
  focused web tests pass and the backend capability/start-route contract is
  now composed. It still requires the credentialed phone smoke in T-0165.
- `T-0165` is the active PM integration and credentialed-smoke ticket. No
  provider credential is committed or required for unit tests.
- A fresh subagent completed a semantic rehearsal through the exact
  repository `.mcp.json` registration using `node --import tsx/esm`. It drove
  nine MCP tools across two runs, reused the returned published memory ID on
  run 2, and confirmed the second call. No files were changed by the tester.
- `T-0161` completed in `e430de4`: the `/demo` control-plane page now has
  Overview metrics, manual/automatic refresh, truthful MCP auth mode, and a
  direct entry point from the authenticated product dashboard. The
  observability response also exposes the mode and the demo API can list
  registered apps for dashboard clients. Its focused web gate passes 8/8;
  the full demo gate passes 97/97 including the live route contract.
- `T-0153B` is no longer active. The simulator/dashboard implementation is
  ready for manual Claude/tunnel rehearsal; the real phone path remains
  blocked on T-0165 and external prerequisites. The branch is
  `demo-sales-voice-agent`.
- `T-0166` AWS demo deployment seam is implemented in the working tree:
  containerized `packages/demo`, configurable host/port and remote
  libSQL/Turso auth, `/healthz`, SST `Cluster`/`Service` Fargate deployment,
  ALB HTTP/HTTPS routing, CloudWatch logging, provider/operator secrets, and
  automatic `/demo` API URL wiring. The image builds and the container health
  smoke passes; no AWS account deployment has been run.
- `T-0167` remains open for operator setup and external verification: set the
  Turso/provider secrets, configure a Route 53 voice domain, deploy the demo
  stage, connect Claude to the deployed `/mcp`, and complete the allowlisted
  Twilio/OpenAI phone smoke.
- `T-0176` completed the typed SDK plugin foundation in `75d915b`; focused
  plugin and `defineAgent` tests pass 12/12 and the SDK build succeeds.
- `T-0178` completed the self-contained `kits/debrief` boundary in `1c75a87`
  and `151020d`; kit tests pass 4/4 and typecheck passes. The package now
  resolves the workspace SDK source so a clean checkout does not depend on a
  stale generated SDK dist.
- `T-0181` completed the Plugins dashboard view in `631bb14`; focused web
  tests pass 11/11. The backend now supplies descriptor metadata as well as
  the existing event stream.
- `T-0177` completed the host integration in `f2430c7` and tightened the
  persistence execution boundary in `cf9bee4`. The
  full demo gate passes 97/97, the dogfood gate asserts all nine plugin
  boundaries were invoked, and the observability endpoint exposes their
  registration/activity data.

## Current execution status

Tickets `T-0142` through `T-0164`, `T-0176`, `T-0177`, `T-0178`, and `T-0181` are complete for the local simulator,
control-plane demo, and locally composed live-phone path. T-0166 is complete
as an implementation seam; T-0165 and T-0167 remain open for credentialed
provider/deployment smoke. Local integration tests must not be promoted into a
provider smoke result.

The verified runnable path is `npm run demo:server` plus the web app's `/demo`
page; the process MCP path is `npm run start:stdio --workspace
@kitstackco/demo`. Loopback HTTP was verified for MCP `initialize`,
`tools/list`, and observability. HTTP app-token mode was verified for both 401
rejection and valid-token discovery. The simulator and local stdio path are
the accepted fallback; `auth-none` is loopback-only.

The live phone path is runnable from the server entry point when all required
environment variables are present. A public tunnel, provider credentials, and
an allowlisted test number are absent from the verified environment, so no
credentialed call is claimed.

## Remaining integration and external rehearsal

The local simulator demo can be rehearsed through Claude.ai now. The live
provider rehearsal starts after the operator supplies the T-0165 prerequisites:

1. Provide a controlled HTTPS/WSS tunnel, Twilio credentials/from-number, an
   OpenAI Realtime API key/model, and one allowlisted E.164 destination.
2. Run the protected server, register/issue the connector token from `/demo`,
   and connect Claude to the tunneled `/mcp` endpoint.
3. Prepare a debrief in chat, explicitly confirm the allowlisted destination in
   the dashboard, place one short call, and inspect the same session in
   Overview, Usage, and Session Trace.
4. Repeat the simulator or live path after teaching/publishing a correction;
   the second prebrief must retrieve the first run's published memory.

Until the credentialed call gate passes, present the simulator as the verified
voice demo and label the live provider as an unverified integration target.

## Presenter-ready path

The target demo is unreleased and uses synthetic account data. The presenter
may run it locally or use the single-task AWS demo deployment. In either case,
the presenter opens `/demo`, registers the Claude/demo caller app, and keeps
Overview visible while Claude drives the MCP dogfood sequence. Overview proves
that events are arriving and that memory/instruction references are present;
Apps proves registration and short-lived token issuance; Usage proves per-app
identity, tokens, estimated cost, latency, and outcomes; Session Trace proves
the shared session/parent/trace chain.

The direct `/dashboard` link is only a navigation affordance. The existing
marketplace Developer tab and `/admin/dashboard` remain legacy product/admin
surfaces and are not claims about the local demo telemetry. A future product
dashboard integration would need authenticated persistence and tenancy beyond
the eight-hour slice.

### Presenter acceptance gate (T-0161)

- Start `npm run demo:server` and `npm run dev --workspace kitstack-web`.
- Open `/demo`; confirm `Overview`, `Apps`, `Usage`, and `Session Trace` are
  present and the displayed MCP mode matches the server configuration.
- Register an app and issue a token; keep it masked unless configuring a
  connector.
- Run two MCP debrief calls. The second `prepare_debrief` must include the
  memory ID published after run one.
- While the second run completes, use `Refresh` or the five-second poll to show
  changing metrics. Confirm Usage contains app identity, cost, latency, and
  memory/instruction references, and Trace contains parent/trace IDs.
- Reset only after the presentation; confirm the app registration is preserved
  and sessions/memory/telemetry are cleared.

### Live-phone acceptance gate (T-0165)

This remains an open external gate. It is accepted only when all of the
following are true in one controlled rehearsal:

- `POST /t/voice/live/start` is reachable only through the protected demo
  action, requires explicit confirmation, and accepts only the allowlisted
  test number.
- The demo server upgrades `/t/voice/media` to a bidirectional WebSocket,
  validates the Twilio signature, verifies the short-lived signed session
  token, and binds the stream to the prepared session.
- `defineAgent` supervises the bounded debrief lifecycle with its instruction
  version, cancellation/timeout limits, metadata events, and terminal result;
  the provider bridge supplies audio/model lifecycle events without storing
  audio, transcripts, prompts, completions, or tool payloads.
- The allowlisted phone rings, the German agent completes the short scripted
  interaction, an interruption is handled, the next step is read back, and
  the call closes without provider recording/retention.
- Overview/Usage/Session Trace show the same session, app identity, status,
  latency/cost metadata, instruction version, and memory references. Phone
  numbers are redacted from telemetry.

Failure of any external prerequisite keeps T-0165 open; it does not invalidate
the deterministic simulator gate.

## Outcome

Build one vertical slice:

```text
Claude.ai prebrief chat
  → shared session/context
  → memory retrieval + versioned instructions
  → outbound voice debrief
  → structured confirmation
  → feedback/memory write
  → Claude.ai post-call debrief
  → developer UI: app registration, token, cost, per-app observability
```

The demo must run twice successfully. The second run must visibly use feedback from the first run. This is a feedback/policy adaptation loop beneath memory and instructions; it is not model-weight training or a claim of production reinforcement learning.

## Repository reality

The repository is an unreleased prototype. It has been exercised internally but has never been released or deployed to customers. Existing cloud, marketplace, OAuth, Lambda, Turso, and dashboard code is therefore migration material, not a production compatibility constraint.

Current relevant state:

- `packages/sdk` contains the canonical `defineKit`, `defineTool`, MCP protocol, local adapter, views, and CLI.
- `packages/mcp-server/src/router` contains an independent cloud dispatch path with registry lookup, authz, Lambda invocation, audit, OAuth, and app JWTs.
- `packages/mcp-server/src/framework` and `packages/mcp-server/src/kits` duplicate SDK/runtime and kit implementations.
- `serve()` and the cloud router do not share one governed dispatch function. The SDK local adapter accepts `checkAuthz`, but `serve()` does not provide it.
- Authz is marketplace-shaped (`subscriber`, `activator`, `author`) rather than platform-shaped.
- MCP Apps shells, view registries, dynamic OAuth client registration, app JWT signing, and CLI token issuance already exist.
- There is no generic plugin registry, sales/debrief kit, voice transport, telemetry store, proxy, memory plugin, or instruction-version service.
- `kits/adint` and `kits/fressnapf` are untracked user work and must be preserved. Both currently use the old SDK contract. Fressnapf checkout is simulated; adint is a seeded Stage A read surface.
- There is no root `CLAUDE.md`, although repository instructions refer to one.
- Root dependencies are now installed; `npm run test:run` still exits before collection because the root Vitest include pattern finds no tests. Package-local Vitest checks are the useful baseline until the demo package owns the test command.

## First removal pass

Because the product is unreleased, remove the old identity and duplicate implementation decisively, subject to compile checks.

### C-00 — baseline and recovery checkpoint

Before any deletion or implementation:

1. Run `npm install` at the repository root.
2. Record `npx tsc --noEmit -p tsconfig.json` exit code and error count.
3. Record `npm run test:run` pass/fail counts.
4. Create the demo branch and explicitly commit `kits/adint` and `kits/fressnapf` so the untracked work is recoverable.

Compile check means the TypeScript error count does not increase from baseline. Test check means the failing-test count does not increase from baseline. Exclude `.next` and ignored build output from `rg` counts.

### C-01a — delete ignored deprecated tree

Confirm with `rg` that the ignored `deprecated/` tree has no live consumers, then delete only that tree. Do not touch `.track/`, `kits/adint`, `kits/fressnapf`, or active source.

### C-01b — duplicate runtime removal (explicit cut)

The remaining duplicate-framework/kits migration is roadmap §5 step 1 but is not a demo dependency. It is moved to the explicit cuts for this eight-hour slice. The demo package imports only from `packages/sdk` and its own runtime package.

When this follow-up is executed, move still-needed helpers out of `packages/mcp-server/src/framework` first, then remove duplicate kits and `defineKit`/`defineTool`/`kit-runtime`. Update the hardcoded `packages/mcp-server/package.json` exports, web imports, tests, seed scripts, and infrastructure together.

### C-02 — isolate the demo runtime

Create a new `packages/demo` workspace package. Its only internal dependency is `@kitstackco/sdk` plus the selected storage dependency. It must not import from `packages/mcp-server/src/framework`, `router`, or `kits`; copy, do not import, the small `jose` token pattern needed from the router.

Use one local Node runtime rather than depending on SST/Lambda/Turso/Entra setup. Store demo data in a dedicated SQLite/libSQL file, not `databases/local.db`.

Expose:

- `POST /mcp`
- `POST /t/voice/start`
- `POST /t/voice/status`
- `POST /v1/apps/register`
- `POST /v1/apps/:id/token`
- `POST /v1/chat/completions`
- `GET /api/demo/observability`
- `GET /api/demo/sessions/:id`
- `POST /api/demo/reset`

The reset endpoint clears memory, sessions, and telemetry while preserving app registrations and tokens. It is demo-only and must be guarded by an explicit demo-mode flag.

For Claude.ai, implement the SDK `auth-none` path and document the public-tunnel caveat. If the target Claude.ai connector requires OAuth, add isolated local discovery/authorize/token/register endpoints by copying the shape of `router/oauth/*`; do not import the cloud router.

MCP, proxy, voice, memory, instructions, and UI must use the same local runtime and telemetry store.

## Workstreams and tickets

### A. Telemetry foundation

O-01 is the first code written. Freeze its record type before any emitter exists.

#### O-01 — shared metadata-only telemetry

Persist:

```ts
{
  id,
  timestamp,
  parentId?: string,
  orgId,
  appId?: string,
  sessionId,
  channel,
  pluginId,
  kitId,
  operation,
  model,
  requestTokens,
  responseTokens,
  latencyMs,
  estimatedCostUsd,
  outcome,
  instructionVersions,
  memoryIds
}
```

`parentId` makes UI-03 a trace tree. `appId` is nullable for boot events before token issuance. Persist no prompts, completions, audio, transcripts, or tool payloads. Add append/query/aggregate/reset tests.

### B. SDK and plugin foundation

#### P-01 — minimal plugin contract

Add `packages/sdk/src/plugins` with `PluginManifest`, `Plugin`, `PluginContext`, and `PluginRegistry`.

Concrete demo registrations are:

```text
persistence: libsql
kit: debrief
memory: default
instructions: debrief-baseline
ai: demo-compatible
http: demo-routes
trigger: voice-http
channel: voice
proxy: demo-openai-compatible
```

Do not register a connector plugin in this window; connector remains a future roadmap kind.

Required behavior:

- register and reject duplicate IDs
- look up by ID and kind
- list capabilities
- initialize/stop plugins
- emit `plugin.registered`

Wrap `KitDefinition` as a plugin. Do not redesign every existing kit.

#### P-02 — compatibility context

Add the future context shape for new code:

```ts
{
  db,
  identity,
  channel,
  session,
  telemetry,
  audit,
  log,
  memory,
  instructions
}
```

Existing kits remain behind a compatibility adapter. Only the new sales kit uses the new context during this work window. `connectors` is deliberately omitted because no connector instance exists in the demo.

#### P-03 — unified demo dispatch

Implement:

```ts
dispatch({
  identity,
  channel,
  sessionId,
  pluginId,
  kitId,
  command,
  args
})
```

Order:

```text
resolve → identity → demo grant → instruction/memory context
→ invoke → telemetry/audit → result
```

The MCP, HTTP trigger, voice, and proxy surfaces must all call this function.

### C. Memory, instructions, and feedback

#### M-01 — structured memory plugin

Create a SQLite-backed store with `memory_entries`, `memory_versions`, `memory_edges`, and `memory_feedback`. Use `@libsql/client` in `packages/demo` (already present in the monorepo); do not add SQLite dependencies to `packages/sdk` and do not reuse `databases/local.db`.

Implement:

- `memory.save`
- `memory.load`
- `memory.feedback`

Entries are structured procedures, preferences, applicability, scope, version, source session, confidence, and status. `memory_feedback.correction` is operator-entered free text, not transcript content. Store no raw conversation, prompt, completion, audio, or tool payload.

Every read and write emits telemetry with IDs and metadata.

#### M-02 — baseline instruction plugin

Load instructions from versioned files next to the sales kit, for example:

- `kits/debrief/SKILL.md`
- `kits/debrief/instructions/interviewer.md`
- `kits/debrief/instructions/extraction.md`

Return instruction ID, content, version/hash, and source. Do not return `locked` unless it is implemented as `true` when the file hash matches a pinned hash in the kit manifest. Log the ID and version on every session.

Do not implement Beta features such as staged rollout, A/B overrides, promotion, expiry, or contract-version invalidation.

#### M-03 — teach/replay loop

After confirmation:

1. save the structured outcome;
2. capture corrections;
3. create/update a candidate memory entry;
4. link it to the session and instruction version.

On the next prebrief, load applicable memory into the context pack and expose the retrieved memory ID in the session trace.

### D. Sales/debrief kit

#### S-01 — new sales kit

Create `kits/debrief` using the SDK.

Minimum tools:

- `prepare_debrief`
- `get_session`
- `get_debrief`
- `confirm_debrief`
- `teach_from_correction`

`prepare_debrief` creates the session, loads memory, resolves instructions, creates a hardcoded synthetic context pack, and returns a call-ready result.

#### S-02 — cross-channel session state

Implement:

```text
prepared → calling → awaiting_confirmation → confirmed
                                      ↘ partial → confirmed
any provider/start error → failed
```

`confirm_debrief` produces `partial` when confirmation is incomplete or uncertain. `teach_from_correction` may transition `partial → confirmed` only after explicit correction and confirmation. One session ID must span Claude prebrief, voice, post-call retrieval, observability, and feedback.

#### S-03 — debrief voice agent on `defineAgent` v1

Keep the interview policy specialized, but run its autonomous lifecycle through
the bounded `defineAgent v1` primitive. This is an intentional amendment to
roadmap §9.3: the real phone path owns the loop, so a provider adapter alone is
not sufficient. The agent is still one-kit/one-trigger only and has no graph
DSL, cross-kit orchestration, fan-out, or general workflow engine.

The current v1 contract is intentionally bounded and text-turn shaped. It
owns one run's session isolation, turn source, model/output seam, declared
tools, instruction version, max turns, wall-clock limit, cancellation, and
metadata-only lifecycle hooks. The current Realtime adapter uses it as a
bounded supervisor: Twilio/OpenAI Realtime remains the low-latency audio and
speech-generation connector, while content-free provider turn/interruption/
stop/error events feed the agent lifecycle. This is sufficient for the first
demo boundary, but it is not yet a stream-native `defineAgent` model connector
that directly owns every audio turn or Realtime function-call event. Do not
describe it as full agent-controlled audio orchestration.

The target integration must still provide a precomputed context pack, versioned
instructions, a restricted tool subset, turn and wall-clock limits,
cancellation, provider failure, barge-in, and a terminal result mapped to the
existing debrief state machine. A future stream-native SDK extension is
required if direct per-audio-turn tool/model ownership becomes a product
requirement.

### Real-call tickets

#### T-0162 — `defineAgent v1` bounded loop — implementation slice complete

Add an SDK-level definition and runner for one kit, one trigger, one model
connector, versioned instructions, a finite tool subset, session state,
cancel/timeout/failure handling, and structured terminal results. Add a
debrief-agent adapter that turns the prepared session context into the
voice-interviewer loop. The runner owns turn telemetry; it must not persist
audio or transcripts.

Current evidence: the SDK primitive and focused tests are landed. Its provider
neutral seams support bounded turns, tools, cancellation/timeouts, and
metadata-only lifecycle events. The demo voice adapter is a supervisor around
provider-owned Realtime events. The full live-phone acceptance remains in
T-0165 because the v1 SDK contract does not itself transport audio.

#### T-0163 — Twilio PSTN + OpenAI Realtime transport — isolated slice complete

Add the outbound-call endpoint using Twilio's Calls API, returning TwiML with
`<Connect><Stream>` to a public `wss` media endpoint. Bridge Twilio's base64
G.711 μ-law 8 kHz media to OpenAI Realtime using the matching G.711 μ-law
input/output format. Translate provider events into `defineAgent` turns and
send generated audio back to Twilio. Validate `X-Twilio-Signature`, bind the
stream to a signed KitStack session token, and emit metadata-only call,
turn, model, latency, usage, and terminal events.

Current evidence: transport seams and focused tests cover Calls API request
construction, TwiML, signed session claims, Twilio signature validation,
G.711 μ-law 8 kHz forwarding, interruption translation, and metadata usage
events. No allowlisted number has been rung from this repository state. The
ring/greeting/objection/read-back/close acceptance is T-0165, not current
status. Provider recording and retention remain explicitly off by contract.

#### T-0164 — controlled live-call demo gate — UI slice complete

Add a protected dashboard/MCP action to start one live call for the prepared
session, require an explicit destination-number confirmation, redact phone
numbers from telemetry, enforce a per-session duration/cost cap, and show live
status in Overview/Trace. Keep the simulator action available beside it and
label the provider clearly.

Minimum behavior:

- German greeting with account context
- one open question
- one or two gap-fill questions
- read-back
- confirmation
- graceful close

Use synthetic accounts. CRM/calendar/SMS integrations remain future connectors; the demo records a structured local commit instead.

#### T-0165 — compose, protect, and credential-smoke the real phone path — local composition complete; external smoke open

The local integration of T-0162–T-0164 is complete without changing the
simulator contract. The remaining work is the credentialed smoke:

1. Compose the signed session-token codec, Twilio Calls client, OpenAI
   Realtime socket factory, `createDefineAgentVoiceLoop`, and prepared-session
   lookup in the demo server.
2. Mount the protected `POST /t/voice/live/start` action and the `/t/voice/media`
   WebSocket upgrade. Require `confirmation: true`, enforce the configured
   E.164 allowlist, bind the call to the prepared session, and expose a live
   capability/status shape consumed by `/demo`.
3. Preserve the privacy boundary: `Record=false`, no provider retention, no
   audio/transcript/prompt/completion/tool-payload persistence, and no raw
   phone number in telemetry or browser responses beyond the explicitly
   confirmed destination flow.
4. Add integration tests with fake Twilio/OpenAI sockets and a signed token,
   then run the local server route/upgrade checks. These tests are not a
   credentialed provider smoke.
5. Only after the integration checks pass, run one operator-controlled smoke
   using the README environment contract, an allowlisted test number, and a
   public HTTPS/WSS tunnel. Record pass/fail evidence without recording audio
   or committing credentials.

Acceptance: the live-phone gate above passes, or the ticket remains open with
the failing external prerequisite recorded. A blocked provider smoke must not
be converted into a “done” status by passing unit tests.

#### T-0166 — package and deploy the demo voice service — implementation complete

Implement the smallest AWS runtime that can host the already-composed voice
path without changing the KitStack router:

1. Make the Node server bind to an injected host/port and expose `/healthz`.
2. Allow the demo app to connect to a remote libSQL/Turso URL with an auth
   token while preserving `:memory:` and local-file defaults.
3. Add a production-shaped container image from the repository root workspace.
4. Add SST `Cluster`/`Service` infrastructure in a dedicated VPC with one
   arm64 Fargate task, ALB HTTP routing, optional Route 53 HTTPS/WSS routing,
   CloudWatch logs, and provider/operator secret injection.
5. Wire the existing `/demo` dashboard to the deployed service URL and keep
   the live capability disabled until the public HTTPS/WSS and provider
   contract is complete.

Acceptance: `npx tsc --noEmit`, the package's 97-test suite, Docker image
build, and a temporary container `/healthz` smoke all pass. No AWS deploy is
claimed until T-0167 is run with operator credentials.

#### T-0167 — deploy and smoke the AWS demo — operator-gated / open

After the operator supplies external values:

1. Set remote Turso/libSQL secrets and the demo operator/destination secrets.
2. Set `KITSTACK_DEMO_VOICE_DOMAIN` to a Route 53-managed HTTPS domain.
3. Set Twilio account/from-number and OpenAI Realtime credentials.
4. Deploy `--stage production` and verify the printed service URL plus
   `/healthz`; the operator has selected production as the deployment stage for
   this unreleased demo.
5. Connect Claude to the deployed `/mcp`, register/issue the app token, and
   run the prebrief → call → debrief → teach/publish → second-run sequence.
6. Verify Overview, Apps, Usage, and Session Trace against the same session;
   record provider and deployment failures as evidence rather than masking
   them with simulator output.

Acceptance: one short allowlisted real phone call completes with recording and
provider retention disabled, and a second run retrieves the published memory.
If keys, domain, Route 53, or provider access are absent, the ticket remains
open and the simulator remains the verified fallback.

### E. Voice channel

#### V-01 — provider adapter

Define a provider-neutral interface for starting calls and receiving status/media. Implement:

- Twilio adapter for a real PSTN call and bidirectional media stream;
- scripted simulator for deterministic fallback/replay.

The simulator is the default. For live providers, disable provider-side recording/retention explicitly and emit a call-start event recording that setting.

#### V-02 — voice endpoints

The simulator `voice/start` and `voice/status` endpoints are implemented and
verified. The live start route and media WebSocket are mounted and protected
by the server composition. Validate provider signatures where configured. Do
not retain audio or transcripts.

#### V-03 — external smoke gate

After T-0165's local composition checks, verify Twilio credentials, OpenAI
Realtime access, a public HTTPS/WSS tunnel, an allowlisted destination, and
that a Claude.ai custom connector reaches `/mcp` and lists tools. If live setup
fails, use the simulator and label the provider smoke as unverified.

### F. Proxy and observability

Events include app registration/token issuance, MCP calls, plugin registration, memory reads/writes, instructions served, voice calls, inference, and session completion.

#### O-02 — app registration and tokens

Copy the `jose` sign/verify pattern from `packages/mcp-server/src/router/app-token.ts`; do not import the existing function. Define a new claim set `{ sub: appId, org, scopes[], exp }`. Implement app registration and short-lived token issuance. Keep OAuth client registration for Claude MCP connectivity separate from developer app credentials.

#### O-03 — minimal OpenAI-compatible proxy

Implement `POST /v1/chat/completions`:

1. validate bearer token;
2. derive `appId`;
3. attach identity/app headers;
4. stream to an OpenAI-compatible upstream;
5. read usage or estimate tokens;
6. estimate cost from a small pricing table;
7. emit inference metadata.

Text inference for extraction/read-back routes through this proxy with the app token. Realtime audio calls emit inference telemetry directly through O-01 because they cannot use a chat-completions-shaped proxy. The proxy is load-bearing for the demo.

Do not implement LiteLLM routing, retries, priority scheduling, or learned model routing.

#### O-04 — observability queries

Provide aggregates by app, plugin, kit, session, channel, and operation:

- cost
- tokens
- latency p50/p95
- success/error rate
- memory reads/writes
- instruction versions
- session timeline

### G. Developer UI

Reuse the existing dashboard styling where useful, but make the new identity developer/platform-oriented.

#### UI-01 — Apps screen

Show registered apps, scopes, created time, token issuance, expiry, masked token, and registration/token events.

#### UI-02 — Usage screen

Show cost, tokens, latency, outcomes, channel breakdown, kit/plugin breakdown, memory operations, and instruction versions. Add an app filter.

#### UI-03 — session trace

Render:

```text
prebrief
  → memory.load
  → instructions.resolve
  → voice.start
  → voice.completed
  → debrief.confirmed
  → memory.feedback
```

This is the primary proof that all surfaces use the same data plane.

## Eight-hour sequence

| Time | Tickets | Output |
|---:|---|---|
| 0:00–0:15 | C-00 / V-03 | Dependencies/checkpoint verified; live voice vs simulator and Claude MCP reachability decision |
| 0:15–1:05 | O-01 | Telemetry record/store frozen and tested first |
| 1:05–1:35 | C-01a / C-02 | Deprecated tree removed; isolated demo server with reset and MCP auth path |
| 1:35–2:25 | P-01–P-03 | Plugin registry and unified local dispatch |
| 2:25–3:25 | O-02–O-03 | App registration, token, proxy on the text-inference path |
| 3:25–4:40 | M-01–M-03 | Memory, instructions, feedback/replay |
| 4:40–6:10 | S-01–S-02 | Sales kit and session lifecycle |
| 6:10–7:10 | S-03 / T-0162 | Bounded `defineAgent` voice lifecycle |
| 7:10–7:45 | V-01–V-02 / T-0163 | Simulator plus isolated live transport |
| 7:45–8:00 | UI-01–UI-03 / T-0164 | Apps, usage, trace, live-call UI seam |
| post-window | T-0165 | Server composition, integration checks, credentialed smoke |

## Acceptance criteria

### Verified local demo

The simulator/control-plane demo is accepted when this works twice:

1. Claude.ai connects to the demo MCP endpoint.
2. A chat prebrief creates a session.
3. Memory retrieval and instruction resolution are visible in the trace.
4. The voice call starts and conducts the short German interview.
5. The result is read back and confirmed.
6. Claude retrieves the completed debrief in chat.
7. The developer UI shows the same session, app identity, token event, calls, cost, latency, memory IDs, and instruction version.
8. A correction produces feedback and a memory candidate.
9. The second prebrief retrieves that learned item.
10. Reset restores the pre-run-1 state while preserving app registrations and tokens, and run 1 can be repeated.

### Real-phone target

The real-phone target additionally requires T-0165's live-phone acceptance
gate. The target is not represented as current status until a credentialed
allowlisted call has completed successfully.

## Explicit cuts

Not part of this eight-hour implementation:

- full six-kit context migration;
- duplicate framework/kits relocation and deletion (C-01b; roadmap §5 step 1 follow-up);
- production dispatch parity;
- Entra/OBO, Dynamo/Turso/Lambda deployment;
- HubSpot, calendar, SMS, and Stripe integrations;
- EventBridge scheduling and Fargate production runtime (the single-task
  Fargate demo service is now in scope; production hardening is not);
- generic multi-agent orchestration, graph DSL, cross-kit chains, and retries;
- LiteLLM integration and learned model routing;
- instruction rollout/A-B/promotion;
- full eval harness;
- actual model-weight reinforcement learning;
- credentialed provider smoke and public-WSS operation before T-0165;
- adint Stage B;
- Fressnapf checkout changes.

## Decisions recorded

1. The codebase is an unreleased prototype adopting a new product identity; old marketplace behavior is not a release-compatibility constraint.
2. Remove only the ignored deprecated tree in the demo window. Duplicate framework/kits relocation is C-01b and an explicit cut.
3. Use one `packages/demo` runtime and one dedicated `@libsql/client` database at `databases/demo-observability.db`; do not reuse `databases/local.db` and do not add storage dependencies to the SDK.
4. Use `kits/debrief` as the kit name.
5. Keep the debrief interview policy specialized, but run the real voice
   lifecycle on bounded `defineAgent v1`; the agent is scoped to `kits/debrief`
   and one voice trigger.
6. Treat memory as structured, versioned skills/context, never transcript storage.
7. Serve baseline file-backed instructions and log their versions; defer live overrides. `locked` is omitted unless derived from a pinned manifest hash.
8. Treat the “reinforcement” behavior as explicit feedback → candidate memory/instruction → next-run retrieval.
9. Proxy is on the demo path: text extraction/read-back uses the OpenAI-compatible proxy with an app token; realtime audio emits direct metadata telemetry.
10. Initial provider/model configuration is Twilio Media Streams + OpenAI Realtime for live voice; simulator otherwise; OpenAI-compatible upstream `gpt-4o-mini` for proxy text inference and extraction/read-back. V-03 may replace these values only after recording the available credential-backed choice.
11. Demo MCP uses SDK `auth-none` behind a public tunnel, with the caveat documented; isolated OAuth discovery is added only if Claude.ai requires it.
12. Preserve `kits/adint` and `kits/fressnapf`; they are committed user work and future plugin-boundary test cases.
13. The real voice acceptance path requires bounded `defineAgent v1`,
   T-0165 server composition, Twilio/OpenAI access, public HTTPS/WSS, and
   Claude MCP reachability. The simulator is the explicit fallback and test
   fixture until that gate passes.
14. `defineAgent v1` is a bounded lifecycle supervisor around the current
   provider-owned Realtime audio/model connector; it is not a stream-native
   audio orchestration contract. Any stronger claim requires a later SDK
   extension and new acceptance tests.
15. Deploy the unreleased voice demo beside the existing KitStack AWS stack as
    one ECS/Fargate service behind an ALB. Keep the existing Kit Lambda VPC and
    MCP router unchanged; use one task for coherent in-process demo session
    state and Turso/libSQL for telemetry and memory persistence.
