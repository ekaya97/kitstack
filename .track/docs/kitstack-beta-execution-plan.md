# KitStack Beta Execution Plan

**Status:** Controlled demo P0 complete; local-mock beta-hardening P0 is next; plugin, audit, and platform-dashboard implementation slices are integrated  
**Date:** 26 September 2026  
**Repository checkpoint:** `f4c9f5f` is synchronized across local `dev`/`main` and `origin/dev`/`origin/main`
**Scope:** close the sales-debrief demo gate, then move KitStack from a working vertical slice to a beta-capable platform

**Active execution goal (P0-local):** close the remaining local governance,
provider-seam, connector-contract, dashboard-evidence, and durable-binding gaps
using deterministic mocks. Entra, Twilio, SaaS accounts, and live OTLP/SIEM
are later conformance gates, not prerequisites. Keep KitStack a thin plugin
wrapper; do not introduce an orchestration or workflow framework.

**P0 status:** complete for the controlled invite-only beta slice. The local
OpenAI Realtime path completed a real tool-call and persistence rehearsal; the
full local dogfood path completed prepare, voice/simulator, partial teaching,
approval/publication, confirmation, timeline, and second-run memory retrieval.
Identity/grants tests, tenant-scoped persistence tests, dashboard evidence,
typecheck, operations safety, and local reset/recovery are green. Twilio is
retained as a connector seam and is not a demo acceptance blocker. Full Entra
tenant federation, a second production kit, broad connector coverage, SIEM
export, and deployed rollback rehearsal remain follow-up work unless required
by the pilot contract.

This document is an execution plan, not a new product specification. It uses
the architecture and stage gates in:

- `.track/specs/kitstack-implementation-roadmap.md`
- `.track/docs/8-hour-sales-voice-agent-execution-plan.md`
- `.track/docs/sales-voice-agent-demo-target-plan.md`
- `.track/docs/sales-voice-agent-demo-runbook.md`

The plan review is recorded in `.track/docs/kitstack-beta-execution-plan-review.md`.
Its blocking verification finding is now resolved by T-0196; execution is
proceeding against the reviewed ticket map below. The review's explicit
decisions supersede any earlier wording in this document.

### 0.1 Reviewed execution map (historical baseline)

This is the review's original gate map. Section 0.5 is the current execution
ordering after reconciling merged tickets and deferring external dependencies.

The review created the complete dependency graph in `.track/tickets` rather
than staging ticket creation. The actual ticket IDs are the source of truth:

| Gate | Workstream | Tickets in execution order | Target |
|---|---|---|---|
| G0 | Verification/demo | T-0194, T-0196 | 30 Sep 2026 |
| G1 | Context/dispatch | T-0197, T-0198, T-0199, T-0209 | 31 Oct 2026 |
| G2 | Identity/runtime/governance | T-0200, T-0160, T-0125, T-0202, T-0111, T-0206, T-0205, T-0207, T-0208, T-0210, T-0211, T-0213 | 15 Dec 2026 |
| G3 | Public host/platform UI | T-0214, T-0215, T-0134 | 31 Jan 2027 |
| G4 | Guidance/memory/dogfood/beta | T-0216, T-0217, T-0218, T-0124, T-0126, T-0219, T-0220, T-0221, T-0222 | 30 Jun 2027 |

Supporting operator and discovery gates are deliberately separate: T-0201 is
the real Entra tenant/consent/user gate; T-0203 and T-0204 remain blocked on
pilot CRM and calendar provider decisions. T-0202 is the first connector
contract and Twilio voice/SMS plus REST/OpenAPI implementation. T-0207 uses a
non-voice fixture first; T-0124 is the second real `defineAgent` customer.
T-0159 is folded into T-0194. Pre-pivot T-0109 is superseded by T-0212;
T-0110 and T-0117–T-0121 remain parked, not deleted.

Review decisions applied to all workstreams:

1. `KitContext` gains request-scoped `session: { id, traceId, parentId? }`;
   instructions and memory remain composed capabilities.
2. `RequestIdentity = { principal, actor, delegation? }` is frozen in W1;
   W3 adds identity producers.
3. G1 dispatch acceptance covers MCP, HTTP trigger, and the existing debrief
   scheduler internal invocation. Later channels add conformance tests.
4. Entra work is split between federation code (T-0160) and operator setup
   (T-0201).
5. `kit build` emits the container artifact; W7 provides one deployment file.
6. Connector instances begin with Twilio voice/SMS and REST/OpenAPI; CRM and
   calendar are pilot-dependent.
7. If G2 slips, cut W7 CLI verbs and W6 SIEM export before cutting W3,
   W6-T1, or W6-T3.

### 0.3 Scope correction — 17 September 2026

The beta target is a thin KitStack wrapper, not an agent orchestration
framework. Kits own business behavior; plugins own provider-specific
capabilities such as persistence, memory, instructions, AI, voice, HTTP,
connectors, and triggers. KitStack owns composition, request context,
identity, grants, dispatch, lifecycle boundaries, telemetry, and proxying.

P0 is limited to the smallest proof of that contract:

- the debrief prepare/call/confirm/publish/retrieve flow works repeatedly;
- the debrief kit consumes capabilities through explicit plugin boundaries;
- authentication, grants, and tenant isolation are enforced for the beta
  audience;
- metadata-only telemetry and cost attribution are visible in platform Views;
- secrets are excluded from arguments and telemetry;
- basic retention/deletion and recovery/runbook evidence exists.

The following are deliberately not P0 blockers: Twilio phone completion,
full Entra tenant federation when the beta is invite-only, a second real kit,
CRM/calendar breadth, external OTel/SIEM infrastructure, a generalized job or
workflow engine, model routing, graph/chain abstractions, and a polished
multi-target CLI. They remain P1/P2 validation and hardening work.

The plugin shape is now a prerequisite design gate. The research and decision
record are in `.track/docs/plugin-first-research.md`. No new connector or
capability implementation should begin until its contract, provider
implementation, binding, scopes, lifecycle, and reuse story are explicit.
The SDK registry is the canonical direction; the debrief registry is a
composition compatibility layer to be reduced rather than a second platform
registry.

P0 plugin-shape work is tracked in `T-0223`: canonical SDK manifest fields,
explicit debrief capability declarations, manifest validation, and contract
tests are implemented and complete. Runtime dependency resolution and scoped
capability handles remain a P1 follow-up.

P1 execution started with two disjoint contract slices, both now integrated:

- `T-0224`: capability resolution by contract/version in the SDK registry
  (`71d0a74`);
- `T-0225`: storage/connector binding scope and secret-safety hardening
  (`c9fa687`).

Integration evidence: focused SDK gate 23/23, full SDK suite 233/233, SDK
build and declarations green, debrief suite 159/159 with loopback permission,
Fressnapf connector test 1/1, and debrief typecheck green. The small fixture
migrations required by the new mandatory binding scope are included in the
integration commit.

Both are deliberately SDK-only and preserve the thin-wrapper boundary.

The next P1 batch is now integrated locally:

- `T-0208`: dispatch-denial audit forwarding into the SDK hash chain and
  optional SIEM sink (`a8c599a`);
- `T-0215`: platform audit-status View and fail-closed organization scoping
  (`87e8eb4`, `aab1393`).

The platform dashboard remains honest about unavailable external exporter
delivery (`not_reported`); deployed SIEM and dashboard verification remain
operator gates.

### 0.4 Repository hygiene checkpoint — 26 September 2026

The integrated checkpoint is clean and synchronized with GitHub. The primary
branches are intentionally limited to `dev` and `main`; both point to
`f4c9f5f`. Historical agent worktrees under `/private/tmp` were prunable
because their worktree metadata pointed at deleted directories. Those records
are safe to prune. Merged agent branches may be removed locally and remotely
alongside that cleanup; unmerged agent branches remain preserved until their
ticket is explicitly accepted, superseded, or closed. The reviewed agent
branches from the completed integration batch were merged into `dev` (with
newer implementations retained where an older branch conflicted) and then
removed from the remote after SDK, MCP, and debrief validation passed.

The next implementation batch must start from `dev`, use at most two bounded
agents, and update the corresponding ticket and validation evidence before
merging. Review-status tickets are not assumed complete merely because a
branch exists; acceptance requires integration and tests on the current
checkpoint.

### 0.5 Reprioritization — local-mock-first beta execution — 26 September 2026

The ticket ledger has been reconciled against `f4c9f5f`. The implementation
slices for T-0125, T-0134, T-0160, T-0197, T-0198, T-0199, T-0202, T-0205,
T-0206, T-0207, T-0209, T-0210, T-0211, T-0212, T-0213, T-0214, T-0217, and
T-0111 are now marked `done`. Their remaining live-provider or deployed-stage
evidence is not erased; it is explicitly separated into T-0201, T-0203,
T-0204, T-0222, and T-0231.

The next execution order is:

1. **T-0226:** close the SDK `serve()` authorization callback gap.
2. **T-0227 and T-0229 in parallel:** add deterministic provider-shaped seam
   fixtures and reusable connector conformance tests.
3. **T-0228 and T-0230 in parallel:** prove the platform dashboards from local
   source-backed data and persist the capability/binding lifecycle locally.
4. **T-0216, T-0218, and then T-0124:** add guidance/memory reuse and a second
   local `defineAgent` customer without building an agent framework.
5. **T-0201/T-0203/T-0204/T-0231 only when a named pilot requires them:** run
   external identity, voice, collector, CRM, and calendar conformance.

The detailed dependency graph, write-scope boundaries, exit gates, and
parallelism rules are persisted in
`.track/docs/kitstack-beta-workstreams-and-ordering.md`. The SaaS connector
research and selection boundary are in
`.track/docs/saas-connector-integration-research.md`.

### 0.2 Execution checkpoint — 16 September 2026

The first G1 integration slice is landed on `dev`:

- `ccecb66` restores the root/package verification gates.
- `ff69fcb` lands the SDK v0.2 request-scoped context and hard-break API.
- `742f990` migrates the debrief kit tools and Views to `(ctx, args)` / `(ctx)`.
- `93fafc1` migrates the seven maintained non-debrief kits and adds metadata
  helpers for 84 tools.
- `f30cf86` propagates and validates W3C `traceparent` at the MCP boundary.
- `7ee986b` routes the local SDK adapter through the shared dispatch core and
  adds dispatch ordering, denial, validation, and provider-failure tests.
- `6fc7db9` adds the grant-controlled `kits/platform` kit with registry,
  usage/FinOps, overview, and grants Views over injected metadata readers.
- `3c78bc3` plus `5dba148` enforce `kit:use`/`kit:act` and identity boundaries
  at the MCP router, including compatible test mocks.
- `aa50b2a` adds content-free per-turn `defineAgent` usage/cost/trace metadata
  and a deterministic non-voice fixture.
- `f0f34c6` routes remote Lambda tool execution through the same dispatch core
  used by local `serve()`.
- `43597d` adds the connector binding seam and Twilio voice/SMS plus REST/OpenAPI
  instances; `3e7dd17` makes the Fressnapf fixture test runner kit-local.
- `45793dd` promotes the metadata-only telemetry contract and OTel adapter seam
  into the SDK.
- `3218566` freezes the chat/shell View host contract; `81abe1e` isolates the
  Adint View test runner.
- `4b0c781` makes all eight maintained kits typecheck through the reproducible
  `npm run typecheck:kits` gate and records the two remaining build/test config
  caveats.
- `7ed26f7` adds the SDK hash-chained metadata-only audit contract and the
  durable debrief libSQL audit store, including verification and JSON/CSV
  export.
- `15ec50a` adds the SDK `createEval` harness: CRUD-baseline versus kit-surface
  scenarios, latency/token/cost/success deltas, CI Markdown output, and a
  promotion gate.
- `8bdf529` documents the debrief metadata boundary; `079615a` adds the beta
  operations runbook and safety scripts.
- `8fbf889` adds SDK trigger/channel contracts and daemon mode; `17a9e54` adds
  declared jobs and lease-aware dispatch; `8f3fe82` composes the live scheduler
  through job → trigger → provider.
- `8220710` adds the portable `kitstack build` container artifact, deployment
  adapter manifest, and artifact hashes/signature metadata. `651a26d` restores
  the kit-local debrief Dockerfile required by the current SST service boundary.
- `70a4429` adds the provider-neutral scoped storage contract and debrief
  libSQL adapter; `b98baea` adds the beta CLI operations and deploy approval
  commands.
- `2a3cb25` adds local-issuer-tested OIDC federation primitives and Protected
  Resource Metadata; `15ede67` hardens JWT canonicalization after a negative
  test found an alternate base64url spelling.
- `bf43014` adds the pinned migration runner and operations safety gate.
- `e38c163` binds the platform kit to the router host and existing
  observability/registry/grants sources; `82e58ed` adds the host-binding
  regression coverage. `517f175` adds the first `/host` shell and View
  catalog for the Adint tenant.
- `d3f6f26` wires the SDK metadata-only telemetry exporter to an OTLP/HTTP
  collector through the debrief host while retaining local persistence.
- `15060f8` updates the MCP protocol test seam for the platform registry
  reader. The serialized MCP gate passes 12 files / 97 tests and is included
  in the current full root gate.
- `d915a2f` integrates the T-0210 golden evaluation slice: deterministic
  presenter/debrief replay, the 44-case Adint fixture, promotion checks, KPI
  summary, and the GitHub Actions eval workflow. `npm run eval:ci` passes
  locally with 100% success for both fixtures.
- The pre-model-routing serialized root gate passed: debrief 154, SDK 216,
  MCP 97, authz 64, web 105, and operations 5 — 641 tests total. No test
  or typecheck worker remains running after the gate.
- `b5d30a4` plus `21bf5c9` complete the SDK HTTP SIEM exporter seam and its
  build fix. `67382ba` adds deterministic declarative model routing by task
  class, explicit cold-start fallback, model.route telemetry, and debrief
  prebrief/FinOps integration. Focused routing tests and SDK build pass.
- `5de6a2a` extends the same model policy to the live debrief voice path:
  conversation routing is resolved before the Twilio/OpenAI bridge starts,
  and routing reasons are carried into defineAgent and realtime inference
  telemetry. The debrief gate passes 31 files / 155 tests with loopback access.
- `20554a9` adds the provider-neutral SDK MCP manifest contract and
  `serve({ mcpServers })` adapter: manifests are data-only, validate
  permission/lock/memory namespace metadata, preserve the source tool schema,
  and map `kit(server, tool, args)` to a native `tools/call` request.
- The earlier serialized root gate passed: debrief 155, SDK 219, MCP 97,
  authz 64, web 105, and operations 5 — 645 tests total. No repository test,
  typecheck, eval, or bundler worker remains running.
- The completed T-0199 conformance slice passes the updated serialized root
  gate: debrief 155, SDK 224, MCP 98, authz 64, web 105, and operations 5 —
  651 tests total. SDK loader context propagation, self-hosted and cloud MCP
  registration, HTTP/schedule trigger envelopes, and scheduler job dispatch
  are covered. No repository worker remains running after the gate.
- `651a26d` restores the `kits/debrief` production image, reconciles stale
  pre-platform authz relation call sites, and makes the web test setup's
  Vitest import explicit. Production deployment completed on 17 September
  2026; `voice.kitstack.co/healthz`, MCP OAuth discovery, and `kitstack.co`
  returned successful read-only smoke responses. The live outbound phone call
  is intentionally not marked complete by health checks alone.

All eight maintained kits now typecheck through the reproducible gate. Content
Planner still has a duplicate existing migration during build, and CRM's
existing test config does not discover its `test/` directory. T-0199 is in
review: local `serve()` and remote Lambda tool execution both use dispatch;
loader context propagation, HTTP/scheduler envelopes, and manifest
registration/passthrough are covered by the final gate. Production registry
population for external MCP servers remains an operational integration task,
not a dispatch-core gap. T-0205 is in review with the metadata-only contract and external
OTLP/HTTP exporter integrated; production collector credentials and live
collector verification remain open. T-0208 and T-0210 have their SDK/debrief
foundations and CI/export slices integrated, while pilot KPI cadence remains
open. T-0217 now has declarative task-class routing and reason telemetry for
debrief text extraction; voice conversation policy wiring and learned routing
remain open.
T-0215 now has router-host binding and source adaptation tests; production
grant/data verification and complete dashboard coverage remain open. The
T-0210 worker worktree is preserved, but its patch is now integrated as
`d915a2f`; no worker is running from it.

---

## 1. Executive summary

KitStack has completed a credible demo vertical slice. The repository now
contains a self-contained debrief kit, an SDK with plugin and bounded-agent
primitives, an MCP router with OAuth, a deployed voice-service path, and
developer-facing registry/usage/observability/FinOps screens.

The remaining work is not another debrief feature. It is to turn the demo's
local composition into the platform contract that beta customers and external
kit developers can safely depend on.

The execution order is:

```text
close provider/demo gate
  -> freeze SDK context contract
  -> unify dispatch and governance
  -> add enterprise identity and grants
  -> formalize storage/connectors/jobs/channels
  -> promote telemetry/audit/evals/deploy into platform contracts
  -> freeze public View/kit APIs
  -> ship platform kit, guidance rollout, declarative model routing, memory
  -> dogfood with a second kit and a non-founder builder
  -> run a controlled beta pilot
```

The critical architectural rule is that the debrief agent remains a forcing
function, not a private platform implementation. Any capability that is
required by debrief and expected to be reusable must land first as an SDK,
router, plugin, connector, or platform-kit contract, with debrief as its first
consumer.

---

## 2. Status quo

### 2.1 Repository and branch state

- The restructuring branches have been merged.
- `dev` now contains the verified gate restoration, SDK context hard break, debrief migration, and authz platform model commits.
- The maintained-kit metadata/context migration and trace-context slices are
  integrated on `dev`; remaining work is conformance and deployment proof.
- `packages/demo` has been removed.
- The debrief runtime and all kit-specific demo code live under
  `kits/debrief`.
- Duplicate MCP framework and duplicate MCP kit implementations have been
  removed from `packages/mcp-server`.
- The current working tree contains only preserved generated/user files
  outside this plan's scope: SST generated declarations and `.dockerignore`.
  The completed T-0210 CI/golden-dataset worker remains paused in its isolated
  worktree rather than consuming more local CPU.

### 2.2 What is working today

#### SDK

The SDK currently provides:

- `defineKit`
- `defineTool`
- `defineLoader`
- `defineView`
- `defineAgent`
- plugin manifests and an in-memory `PluginRegistry`
- local/server runtime and build/deploy tooling

`defineAgent` is intentionally bounded to one kit, one trigger, one tool
subset, one instruction set, and finite turn/time limits. This is the correct
shape for the voice demo, but it is still v1 rather than a generalized agent
platform.

`defineTool` now uses the v0.2 `(ctx, args)` handler/load shape, and
`defineLoader` uses `(ctx)`. `KitContext` carries the storage binding, request
parameters, connector registry, identity, channel, session, telemetry, audit,
and logging seams. Tool execution now has an SDK-owned dispatch core shared by
`serve()` and the deployed router; loader/view invocation and some provider
channels still need conformance work.

#### Router and authorization

`packages/mcp-server` provides the deployed MCP router, OAuth discovery and
flows, registry-backed kit/view routing, audit/logging utilities, and platform
adapter behavior. The router is the current governed production path.

`packages/authz` already contains a tuple-store engine with `check`, grants,
revocation, and listing operations. Its model is still shaped around the
marketplace (`activator`, `author`, subscriptions, reviews), not the platform
scopes required for enterprise kit execution.

The SDK `serve()` path and Lambda/router path now share the tool dispatch core,
including identity, grant, policy, validation, and stable error handling. The
platform kit is now bound to the router host through injected observability,
registry, and grants sources. The remaining gap is to bring loaders/views,
external HTTP, proxy, and all provider channels onto the same envelope and to
connect durable audit and telemetry sinks in deployed hosts.

#### Debrief kit and demo host

[`kits/debrief`](../../kits/debrief) contains:

- customer context and event ledger;
- durable debrief sessions and editable drafts;
- structured prebrief generation;
- memory candidate/approval/publication/retrieval;
- versioned instructions;
- persisted scheduled-call polling and idempotent claims;
- Twilio/OpenAI Realtime adapters;
- bounded `defineAgent` voice supervision;
- MCP, HTTP, stdio, simulator, and voice transports;
- prebrief, confirmation, and customer-timeline Views;
- metadata-only telemetry;
- app registration, proxy metering, and demo observability composition.

The kit is locally verified and the deployed router/View path is integrated.
The direct demo host is a useful fallback and dogfood environment. The actual
credentialed phone call has not been successfully verified. The local OpenAI
Realtime path is the accepted demo voice path; the live phone path remains an
optional provider-seam rehearsal.

#### Dashboards

The current `/demo` surface demonstrates:

- registered apps and short-lived tokens;
- plugin registration and activity;
- runtime/provider health;
- usage, latency, tokens, and estimated cost;
- session/trace relationships.

These screens are currently demo/control-plane screens backed by the debrief
host's libSQL telemetry. They are not yet the multi-tenant platform kit or a
customer-operable observability product.

#### Tests and evidence

- The debrief package has a 137-test suite.
- The debrief kit typechecks and builds its tools, Views, shell, manifest, and
  Lambda bundle.
- The deterministic simulator dogfood path covers two-run memory learning.
- Local MCP, HTTP, View, scheduler, proxy, auth, and dashboard contracts are
  tested.
- Production OAuth, View publishing, service health, and provider credential
  API checks have been exercised.
- A successful deployed Twilio/OpenAI phone rehearsal is still outstanding,
  but it is not a controlled-beta acceptance blocker.
- Debrief typecheck is green after reconciling the persistence adapter with the
  SDK storage value contract.

### 2.3 Current tracker truth

Completed demo-target work includes `T-0184` through `T-0193` and `T-0195`,
plus the earlier `T-0142` through `T-0158`, `T-0176`, `T-0177`, `T-0178`, and
`T-0181` slices.

Still open:

- `T-0194` — controlled local demo rehearsal; complete under the revised
  acceptance criteria. A real phone call and deployed rollback are optional
  provider/operations evidence.
- `T-0223` — canonical plugin capability manifests; complete. The SDK manifest
  is now the canonical inspectable shape and debrief declarations are explicit.
- `T-0159` — Claude tunnel/live provider smoke; backlog and should be merged
  into the final `T-0194` evidence rather than developed as a second runtime.
- `T-0160` — Entra ID federation for MCP OAuth; backlog and required for the
  MVP/pilot identity story, but not required to close the simulator demo.
- Existing roadmap tickets such as `T-0111`, `T-0124`, `T-0125`, `T-0134`, and
  `T-0141` cover parts of the future jobs, agent, storage, shell, and eval
  work. They should be reconciled with the approved plan before execution.

---

## 3. Target state

### 3.1 Target product

At beta, KitStack is a governed runtime and developer platform for kits:

```text
external developer or platform team
  -> defines a kit/tool/view/agent/job using SDK or MCP manifest
  -> tests and evaluates it locally
  -> binds approved connectors and secrets
  -> deploys a signed version to the selected target
  -> runs through one dispatch core
  -> receives one identity, grant, policy, telemetry, and audit contract
  -> operates it through the platform kit/dashboard
```

The debrief kit remains the reference customer workflow:

```text
Claude chat
  -> MCP router/OAuth
  -> debrief kit + prebrief View
  -> persisted session and scheduled job
  -> delegated voice agent
  -> structured confirmation View
  -> customer timeline and memory feedback
  -> platform telemetry, cost, audit, and trace views
```

### 3.2 Target technical architecture

The desired runtime has one governance path:

```text
MCP / HTTP / webhook / schedule / voice / proxy
  -> identity normalization
  -> dispatch({ identity, actor, delegation, channel, kitId, command, args })
  -> kit resolution
  -> grant check
  -> policy + assist/act gate
  -> connector/storage/tool/agent invocation
  -> metadata telemetry + append-only audit
```

SDK-built kits and bring-your-own MCP servers should both enter this dispatch
core. The SDK is a convenience and type-safe authoring layer, not a mandatory
rewrite requirement for existing MCP servers.

### 3.3 Target beta gate

Beta is complete only when all of the following are true:

1. A sales agent runs in at least one real business unit.
2. The unit has an agreed baseline and a measured KPI delta.
3. A non-founder developer or partner builds and operates a second kit.
4. Identity, grants, audit, deletion, and compliance controls are documented.
5. A non-Ströer enterprise can evaluate the platform.
6. A customer can install, deploy, operate, and roll back without founder-only
   runtime intervention.

The current demo proves workflow continuity. It does not yet prove these beta
conditions.

---

## 4. Why the target has been updated

The original target was an eight-hour working sales voice demo. That target was
appropriate for discovering the vertical slice, but it is insufficient as the
post-demo execution target for five reasons.

### 4.1 The demo validated the workflow but exposed platform seams

The demo now proves that persistence, memory, instructions, AI, proxy,
triggers, channels, scheduler, voice, Views, and telemetry can work together.
The next risk is not whether another debrief feature can be added. It is whether
those capabilities are reusable without copying them into every kit or channel.

Therefore the target moves from “finish the demo” to “promote the seams that
the demo exercised into public platform contracts.”

### 4.2 The local demo is composed, but governance is not yet universal

The debrief host has a plugin registry and metadata telemetry, and tool calls
now share a dispatch core across SDK `serve()` and the router. Until loader,
view, proxy, and external-channel conformance plus durable sink wiring are
complete, authz, policy, telemetry, and audit can still diverge outside the
tool path.

For beta, “the same kit has the same governance everywhere” is more important
than adding another provider or dashboard card.

### 4.3 Enterprise identity is now a pilot dependency

The demo can use app tokens and internal-signed service calls. A beta customer
needs user identity, organization boundaries, delegated service identity, and
Entra/OIDC federation. This is not a cosmetic auth upgrade: it determines who
may use, act through, deploy, and inspect a kit.

### 4.4 Developer adoption requires stable authoring and deployment APIs

The demo's internal composition is understandable after restructuring, but an
external developer still lacks a stable context contract, connector binding
model, job primitive, eval path, and self-service deployment flow.

The target therefore includes the smallest coherent developer platform rather
than only the debrief-specific runtime.

### 4.5 Beta requires measurement and compliance, not only functionality

The demo telemetry proves per-app cost and traceability in one host. Beta needs
durable platform telemetry, audit separation, retention, export, eval baselines,
KPI measurement, and a metadata-only compliance story.

The target deliberately does **not** expand into unrestricted reinforcement
learning. The current feedback loop remains:

```text
operator correction
  -> candidate structured memory
  -> explicit approval/publication
  -> next-run retrieval
```

This is controlled workflow learning, not model-weight training.

---

## 5. Non-negotiable constraints

1. One kit's code belongs under that kit's folder.
2. Generic primitives belong in `packages/sdk`; router governance belongs in
   `packages/mcp-server`; organization authorization belongs in `packages/authz`.
3. No second private implementation of a platform primitive inside debrief.
4. One dispatch core governs local, self-hosted, deployed, scheduled, voice,
   and proxy-triggered execution.
5. Every agent is one kit, one trigger, bounded in turns and duration.
6. Telemetry and audit never persist prompts, completions, transcripts, audio,
   or raw tool payloads.
7. External side effects require explicit identity, grant, policy, and audit.
8. The live phone destination remains allowlisted until outbound calling has a
   production-grade policy and consent model.
9. `model: "auto"` starts as declarative routing and always has a safe cold-start
   fallback.
10. No Kit Builder-generated code may bypass the same SDK/router contracts.

---

## 6. Workstreams

Workstreams are ordered by dependency. Work within a row can fan out only after
the preceding contract gate is accepted.

### W0 — Close and document the demo gate

**Priority:** P0 / critical  
**Existing tickets:** `T-0159`, `T-0194`  
**Goal:** establish whether the presenter flow is verified through the local
voice runtime and shared store. Keep provider-phone status separately labelled.

Work:

- run the exact Claude connector flow against `mcp.kitstack.co`;
- verify all three Views;
- schedule without dashboard intervention;
- run the local OpenAI Realtime call with declared debrief tool calls;
- complete confirmation and timeline persistence;
- run the second memory retrieval pass;
- capture dashboard evidence and rollback evidence;
- document provider failures separately from application failures;
- close `T-0159` as evidence under `T-0194` rather than maintaining two smoke
  workflows.

Acceptance:

- local voice establishes a session and persists the provisional draft;
- confirmation/publish and second memory retrieval succeed;
- simulator, local voice, and provider-phone status are labelled truthfully;
- the runbook and roadmap status are updated;
- no new application architecture is added during this gate.

### W1 — SDK context and authoring contract

**Priority:** P0 / critical  
**Goal:** make every capability enter a kit through one typed context.

#### W1-T1 — Define the v0.2 context contract

Target:

```ts
type KitContext = {
  db: StorageBinding;
  connectors: ConnectorRegistry;
  identity: RequestIdentity;
  channel: ChannelContext;
  telemetry: TelemetrySink;
  audit: AuditSink;
  log: Logger;
};
```

Decide whether the old `(db, args, ctx)` form receives one minor-version shim
or is hard-broken. Recommendation: hard-break at `0.2.0`; the repository has
no released external kit compatibility obligation.

Acceptance:

- context types are SDK-owned;
- no kit imports router internals to obtain context;
- identity/channel/audit/telemetry are request-scoped;
- the debrief host can adapt its existing plugins to the new context.

#### W1-T2 — Migrate maintained kits and loaders

Migrate debrief first, then CRM, expenses, content-planner, projects, adint,
and fressnapf as applicable. Add `mode: "assist" | "act"` and a classification
field to tools. Add partial-argument describe behavior that returns schema and
instructions instead of an opaque validation error.

Acceptance:

- one `defineTool` implementation remains in the SDK;
- all maintained kits build and test;
- tool metadata exposes mode/classification;
- loader and tool contexts are consistent.

### W2 — Unified dispatch and governance spine

**Priority:** P0 / critical  
**Goal:** make authorization and policy true for every runtime.

#### W2-T1 — Extract the dispatch core

Implement the single dispatch pipeline:

```text
resolve -> identity -> grant -> policy -> mode gate -> invoke -> telemetry/audit
```

Move shared behavior out of the router protocol handlers and SDK local runtime.
Support both SDK-built kits and registered MCP servers through a manifest-based
passthrough path.

Acceptance:

- `serve()` and the deployed router call the same core;
- authorization hooks cannot be skipped in self-hosted mode;
- tool, loader, job, trigger, voice, and proxy calls share the envelope;
- unknown kit/tool, missing grant, policy denial, and provider failure have
  stable error codes.

#### W2-T2 — Enforce assist/act and policy boundaries

Start with deny lists, explicit act grants, provider allowlists, and argument
validation. Defer the full YAML policy language and classification redaction
until Beta unless a pilot requires them.

Acceptance:

- read tools can run under `kit:use`;
- side effects require `kit:act`;
- scheduled/voice service identities cannot impersonate users;
- denied actions are audited with no sensitive arguments.

### W3 — Enterprise identity and grants

**Priority:** P0 for pilot / high  
**Existing ticket:** `T-0160`  
**Goal:** replace demo identity assumptions with an enterprise identity model.

#### W3-T1 — Expand authorization relations

Replace marketplace-shaped relations with:

```text
kit:use
kit:act
kit:deploy
kit:telemetry
kit:admin
platform:admin
```

Add organization, team, role, application, user, service, and delegated
subjects. Add versioned grant cache with measured revocation latency.

#### W3-T2 — Entra/OIDC federation

Implement issuer and tenant allowlists, JWKS validation, PKCE, dynamic client
registration, Claude-compatible OAuth metadata, user mapping, and service /
delegated identity. Retain app-token auth only for local controlled demos.

Acceptance:

- an Entra user can connect Claude through the existing router;
- organization and user scopes cannot be caller-supplied;
- revocation and role changes take effect within the agreed SLA;
- service-to-service debrief calls preserve principal, actor, and delegation.

### W4 — Storage and connectors

**Priority:** P1 / high  
**Existing ticket:** `T-0125`  
**Goal:** prevent kits from embedding provider-specific storage or API code.

**P1 boundary:** define the binding and capability contracts and ship only the
reference implementations required by a pilot. Do not build a universal
database or connector matrix ahead of demand. Provider behavior remains in
plugins and host bindings.

#### W4-T1 — Storage adapter

Define storage bindings for local libSQL, shared relational storage, DynamoDB,
and object storage. Keep `@libsql/client` out of the SDK. The current debrief
libSQL store becomes the first adapter implementation, not the universal model.

Acceptance:

- kit functions depend on the storage interface;
- provider credentials are resolved by the host at bind time;
- debrief and adint exercise different storage requirements;
- org/tenant isolation is tested at the adapter boundary.

#### W4-T2 — First connector set

Implement only the connectors required by the first pilot:

1. Twilio voice;
2. Twilio SMS;
3. pilot CRM (`hubspot` unless the customer selects another system);
4. one calendar provider, selected from pilot discovery;
5. REST/OpenAPI connector.

Acceptance:

- connector manifests declare capabilities and required scopes;
- secrets never enter tool arguments or telemetry;
- debrief can write one CRM activity and schedule one follow-up;
- a second kit uses the REST connector without custom host plumbing.

### W5 — Jobs, triggers, channels, and agents

**Priority:** P1 / high  
**Existing ticket:** `T-0111`; related `T-0124`  
**Goal:** generalize the debrief scheduler and voice path into platform seams.

**P1 boundary:** expose small lifecycle and trigger contracts. `defineJob` is
not a workflow engine, `defineAgent` is not a graph DSL, and KitStack does not
own model routing, chain composition, or business retries. Scheduling,
provider-specific voice behavior, and other specialized behavior remain
plugins or kit code.

#### W5-T1 — `defineJob` and job manifests

Support cron, rate, one-shot jobs, cancellation, rescheduling, continuations,
timeouts, and job-level identity. Add jobs to `defineKit` and build manifests.

Acceptance:

- a fixture kit defines and builds a job;
- local/container/deployed invocations share the job contract;
- concurrent workers cannot duplicate an external side effect;
- lease expiry is surfaced rather than silently retried.

#### W5-T2 — Trigger and channel contracts

Standardize HTTP, provider-signed webhook, schedule, stream, MCP, and voice
triggers. Each trigger declares its fixed identity, kit allowlist, and channel
metadata. Add daemon mode for latency-sensitive voice runtimes.

#### W5-T3 — `defineAgent` v2 observability

Keep the current debrief voice loop specialized until the stream-native
connector is proven. Extend the generic SDK agent with per-turn metadata:
model, token counts, latency, cost, tool-call count, outcome, cancellation,
timeout, and routing reason. Never include content.

Acceptance:

- debrief voice remains bounded and does not become a graph/orchestration DSL;
- an additional non-voice agent (adint enrichment) runs through the same
  primitive;
- all turns are correlated to the same session/trace.

### W6 — Telemetry, audit, FinOps, and measurement

**Priority:** P1 / high  
**Goal:** promote demo observability into a customer-operable platform contract.

**P1 boundary:** KitStack owns the metadata schema, correlation, cost
attribution, and export interface. External collectors, SIEMs, queues, and
retention backends are deployment/plugin concerns. P0 requires the local or
deployed metadata path and dashboard evidence, not a complete observability
vendor platform.

#### W6-T1 — Durable telemetry contract

Move from the debrief host's local telemetry implementation to a platform sink
with retention/TTL, OTel export, org/team/app/session dimensions, cost
attribution, and metadata-only schema enforcement.

Required fields include:

```text
event_id, timestamp, org_id, app_id?, principal, actor, delegation?,
session_id, trace_id, parent_id, channel, kit_id, plugin_id, operation,
model?, request_tokens?, response_tokens?, cost?, latency_ms, outcome,
instruction_id/version?, memory_ids?, error_code?
```

#### W6-T2 — Append-only audit and SIEM export

Separate authorization, policy, connector, deployment, identity, and admin
events from telemetry. Add hash chaining, export, retention, and verification.

#### W6-T3 — Eval harness and KPI baseline

Implement `createEval` and use it in CI. Measure tokens to first successful
tool, retries, schema failures, latency, task success, cost, instruction
version, memory version, and voice turn latency. Define the sales KPI baseline
with the pilot before claiming product impact.

Acceptance:

- each pilot kit has golden scenarios;
- PRs can report regression deltas;
- platform dashboards can show cost and outcomes without bodies;
- beta has a measurable KPI delta rather than a qualitative demo result.

### W7 — CLI, build, deployment, and operations

**Priority:** P1 / high  
**Goal:** make external developer onboarding reproducible.

**P1 boundary:** provide one reliable build/deploy path, secret binding,
health, and rollback procedure. Defer a broad CLI and multiple deployment
targets until a pilot requires them.

Commands:

```text
kitstack init
kitstack dev
kitstack build
kitstack eval
kitstack deploy
kitstack grants
kitstack connectors bind
kitstack add skill
```

Work:

- one deployment file read by local compose, AWS, and customer-VPC targets;
- signed kit/build artifacts;
- deploy request and admin approval when caller lacks `kit:deploy`;
- View/shell publication and version pinning;
- health checks, rollback, migration, key rotation, and backup/restore.

Acceptance:

- an external developer can build and deploy a kit without editing SST;
- the same artifact works locally and in the selected beta deployment target;
- deployment history, identity, approvals, and rollback are visible.

### W8 — Platform kit and dashboard shell

**Priority:** P1 / high  
**Existing ticket:** `T-0134` is the adint shell driver  
**Goal:** turn `/demo` proof screens into a grant-controlled platform kit.

**P1 boundary:** preserve the focused proof dashboards—registry, grants,
sessions, plugin/tool calls, costs, errors, and audit status. The dashboard
shell consumes platform telemetry and registry plugins; it is not a second
management product.

Platform apps:

- sessions and cost;
- app/plugin registry;
- grants editor;
- connector bindings;
- deploy queue;
- policy decisions;
- per-tool struggle metrics;
- trace explorer;
- audit export status.

The shell and View host contract must be frozen before third-party kit apps are
written. Existing debrief Views are reference implementations, not the final
platform API.

Acceptance:

- dashboards use platform-kit tools and Views;
- access is grant-controlled;
- organization/app/team filtering is server-enforced;
- the debrief and second-kit telemetry appear in the same platform views.

### W9 — Guidance, model routing, and memory

**Priority:** P2 / Beta  
**Goal:** make the telemetry flywheel operational without claiming opaque AI.

#### W9-T1 — Guidance rollout and scoring

Generalize `SKILL.md` and instruction loading into signed/versioned artifacts
with overrides, contract-version pinning, staged rollout, promote/expire,
rollback, and per-version eval scoring.

#### W9-T2 — Declarative `model: "auto"` v0

Start with task-class policy:

```ts
models: {
  conversation: "fast-model",
  extraction: "strong-model",
}
```

Emit the selected model and routing reason. Always fall back to the declared
policy for new organizations with no training data. Learned classification is
Production work, not the first Beta deliverable.

#### W9-T3 — Memory kit v0

Generalize debrief's structured memory into versioned skills with applicability,
scope, ownership, approval, publication, derived-from edges, and namespace
grants. Preserve the no-transcript/no-audio boundary.

Acceptance:

- guidance and memory changes are staged and reversible;
- a later run can explain which version it retrieved;
- cross-org memory isolation passes;
- memory remains graceful degradation, not a hard dependency for kits.

### W10 — Second-kit dogfood and Kit Builder

**Priority:** P2 / Beta gate  
**Existing tickets:** `T-0122`, `T-0124`, `T-0141`  
**Goal:** prove KitStack is a platform and not a debrief monolith.

Use adint as the second serious customer of storage, connectors, jobs, agent,
Views, evals, and dashboards:

1. complete its read surface;
2. migrate it to the SDK context contract;
3. implement shared storage/object-store boundaries;
4. run its non-voice `defineAgent` enrichment loop;
5. add a scheduled crawl job;
6. ship the shell dashboard;
7. move its golden dataset into the eval harness.

Then build Kit Builder in two tiers:

- config tier: connector + template, no generated application code;
- generated tier: OpenAPI/schema → task-shaped tools → tests → eval → PR.

The generator must refuse endpoint mirrors and cannot bypass authorization,
telemetry, audit, or human review.

### W11 — Beta operations, compliance, and pilot

**Priority:** P2 / release gate  
**Goal:** convert technical readiness into a controlled customer beta.

Deliver:

- consent and acceptable-use flow;
- deletion-on-request procedure;
- metadata-only telemetry review;
- works council/BetrVG posture;
- ISO/BSI/NIS2 control mapping without over-claiming certification;
- incident response and provider outage handling;
- key rotation and backup/restore rehearsal;
- tenant isolation and grant-revocation tests;
- pilot onboarding and support runbook;
- KPI baseline, measurement cadence, and success criteria.

Acceptance:

- one business unit is live;
- IT can revoke access without founder intervention;
- one non-Ströer enterprise can evaluate;
- measured KPI delta is reported;
- customer installation and rollback are documented and repeatable.

---

## 7. Dependency and sequencing plan

### Gate G0 — Demo truth

W0 is complete using local OpenAI Realtime/simulator as the acceptance path.
Retain the Twilio phone item as an explicit optional external-provider seam
and do not delay the controlled beta on it.

### Gate G1 — Governed runtime

Complete W1 and W2. No new channel or connector should be treated as a
platform feature before it goes through the unified dispatch core.

### Gate G2 — Pilot-capable platform

Complete W3, W4, W5, W6, and W7. W6's eval baseline and W3's identity/grants
are release blockers, not optional polish.

### Gate G3 — Public API freeze

Complete the View/host contract in W8 before a partner builds a shell app.
After this gate, SDK, manifest, View, loader, plugin, and deployment changes
require compatibility review.

### Gate G4 — Beta proof

Complete W9, W10, and W11. Beta requires a second kit and a real user/business
unit, not merely a larger debrief demo.

### Parallelization rules

After W1's context contract is approved:

- W3 authz design and W6 telemetry schema can proceed in parallel with W2;
- W4 storage/connectors can proceed in parallel with W3 once context types are
  stable;
- W7 eval and CLI scaffolding can proceed in parallel, but deployment cannot
  bypass W2 governance;
- W8 dashboard design can prototype against current demo data, but production
  implementation waits for W6 platform telemetry and W3 grants;
- W9 and W10 start only after W1/W2 contracts are stable.

Do not fan out multiple agents into the same composition root or router files.
Each ticket must declare write scope, contract dependencies, test commands, and
the integration owner before implementation starts.

---

## 8. Prioritization and cut line

### Must ship for MVP/pilot

- unified dispatch;
- SDK context contract;
- authorization scopes and revocation;
- Entra/OIDC identity;
- storage/connector boundary;
- jobs/triggers/channels;
- bounded agent telemetry;
- durable telemetry and append-only audit;
- eval baseline;
- reproducible deployment and rollback;
- at least one real customer workflow.

### Can remain narrow through Beta

- one CRM connector;
- one calendar connector;
- declarative rather than learned model routing;
- memory kit v0 with explicit approval;
- platform dashboard focused on operator and developer proof;
- config-first Kit Builder.

### Explicitly defer

- general-purpose agent orchestration;
- cross-kit graph DSL;
- unrestricted outbound calling;
- transcript/audio retention;
- learned model routing before labelled data exists;
- hosted arbitrary-code multi-tenancy;
- full enterprise connector catalog;
- full YAML policy language if deny lists and act-gating satisfy the pilot;
- SCIM until Entra app roles/group mapping are proven insufficient;
- production HA/shared-org storage redesign until beta load data exists.

---

## 9. Decisions for review

These decisions should be recorded before tickets are created.

| Decision | Recommendation | Why it matters |
|---|---|---|
| `defineTool` compatibility | Hard break at SDK `0.2.0` | No released external kits; avoids maintaining two context models |
| Dispatch ownership | Shared core used by router and `serve()` | Prevents governance drift |
| Pilot identity | Entra/OIDC required; app tokens demo-only | Required for enterprise onboarding and revocation |
| Storage | Adapter contract; libSQL first, shared/Dynamo/object stores next | Debrief and adint have materially different storage needs |
| Voice | Twilio + OpenAI Realtime adapters; specialized debrief loop initially | Keeps latency-sensitive path safe while proving `defineAgent` elsewhere |
| Agent boundary | One kit, one trigger, bounded loop | Prevents accidental framework/graph scope creep |
| Telemetry | Metadata-only, separate audit store | Preserves privacy/compliance posture |
| Model routing | Declarative `model:auto` first | Honest cold-start behavior and immediate FinOps value |
| Memory | Structured correction/skill lifecycle, never transcript learning | Keeps the feedback loop inspectable and reversible |
| Calendar | Choose Google or Microsoft Graph from pilot discovery | Avoids building an unused connector |
| Shell | Freeze host contract before partner apps | The shell becomes a public API at Beta |
| BYO MCP | Manifest-based passthrough supported by dispatch | Lowers adoption cost without weakening governance |

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Live phone remains blocked | Close simulator gate honestly; isolate provider smoke and preserve rollback |
| `ctx` migration expands across all kits | Hard-break now; migrate one kit at a time with compile/test gates |
| Two runtimes diverge | Make dispatch-core tests run against both `serve()` and router adapters |
| Entra work delays pilot | Start tenant/app consent checklist alongside engineering |
| Demo host becomes the product architecture | Every new debrief capability must first land behind an SDK/platform contract |
| Telemetry leaks content | Metadata-only types, negative tests, redaction at boundaries |
| `model:auto` becomes an opaque promise | Declarative policy, explicit routing reason, safe fallback |
| Kit Builder generates endpoint mirrors | Enforce task-shaped tool review and mandatory eval/PR gate |
| Beta shell freezes too early | Run debrief and adint against the host contract before external partner access |
| Founder remains operational bottleneck | Require install, deploy, revoke, rollback, and support runbooks before beta |

---

## 11. Verification strategy

Every implementation ticket must provide:

1. unit tests for its contract;
2. an integration test at the adjacent boundary;
3. a negative/security test where identity or side effects are involved;
4. typecheck/build evidence;
5. a stated migration/rollback path;
6. a ticket work log with the exact commands and counts.

Required recurring gates:

```text
npm run typecheck --workspace @kitstackco/debrief-kit
npm run build --workspace @kitstackco/debrief-kit
npm run test:run
SDK package tests
router/authz tests
web/dashboard tests
eval scenarios
```

Provider smoke is tracked separately from local tests. A passing fake Twilio,
OpenAI, AWS, or socket test is not evidence that a real phone call succeeded.

The baseline gate was restored on 16 September 2026 by T-0196 and currently
passes with local loopback permission: debrief 26 files/137 tests, SDK 16/175,
router 9/66, authz 4/45, and web 16/102 (525 tests total). Any later ticket
must preserve or intentionally explain changes to these counts.

The dogfood sequence should be repeated after each major platform gate:

```text
prepare -> prebrief View -> scheduled execution -> call/simulator
-> confirmation View -> timeline -> partial (teaching variant)
-> correction -> approve/publish -> final confirmation
-> second prepare -> memory retrieval -> reset
```

---

## 12. Execution control loop

1. Keep T-0194 as the demo evidence track. Local OpenAI Realtime tool calling
   and shared-store persistence are the acceptance path; Twilio is tested as a
   connector seam and does not block the controlled beta.
2. Finish each dependency gate with unit, boundary, negative/security,
   typecheck/build, and rollback evidence before claiming its dependants.
3. Fan out only across disjoint write scopes. Integration remains owned by the
   main branch; overlapping scheduler seams are reconciled explicitly.
4. Keep the integrated G2 work thin and contract-focused. Continue with the
   minimum identity, storage binding, dashboard, and operator evidence needed
   by the chosen beta audience; do not expand it into a workflow engine,
   connector marketplace, model router, or LangChain-style abstraction.
5. Dogfood debrief after every gate using:
   `prepare -> prebrief View -> scheduled execution -> call/simulator ->
   confirmation View -> timeline -> partial (teaching variant) -> correction
   -> approve/publish -> final confirmation -> repeat`.
6. Update the ticket work log with exact commands, counts, changed files, and
   evidence. Close a ticket only after a reviewer or the PM integration check
   validates its acceptance criteria.

The immediate goal is not to maximize the number of open tickets. It is to
make the debrief implementation the first complete tenant of a platform that a
second developer and a second kit can use without copying its internals.
