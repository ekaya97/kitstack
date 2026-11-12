# KitStack Beta Workstreams, Ordering, and Parallelism

**Date:** 26 September 2026  
**Checkpoint:** `f4c9f5f` on `dev`, `main`, `origin/dev`, and `origin/main`  
**Execution rule:** local mocks first; Entra, Twilio, SaaS accounts, and live
OTLP/SIEM are later conformance gates  
**Architecture rule:** KitStack remains a thin plugin wrapper. Kits own
business behavior; plugins/connectors provide capabilities; KitStack owns
composition, context, dispatch, grants, lifecycle, audit, telemetry, and
operator surfaces.

## Status quo

The controlled beta slice is working locally. The debrief kit repeatedly
prepares, retrieves memory, runs a `defineAgent` loop, calls tools, persists
updates, asks for confirmation, publishes approved memory, and shows the
customer timeline. The SDK dispatch core, plugin manifests and capability
resolution, scoped storage/connector contracts, trigger/daemon seams,
metadata-only telemetry, audit chain, eval harness, platform Views, shell host,
CLI safety flows, and local artifact/runbook tooling are integrated.

The ticket ledger was behind the repository: implementation-complete tickets
were still marked `review`, while external operator evidence was mixed into
their acceptance criteria. This update separates those concerns. Code and
local contract tests are closed at the current checkpoint. External setup is
not deleted; it is explicitly ordered after the local seams.

The remaining concrete gap visible in the code is that SDK `serve()` creates
`localAdapter` without passing the available `checkAuthz` callback. That is a
real governance gap and is the first implementation ticket.

## Target

Beta means a developer can run a kit locally with deterministic providers,
inspect the same registry/connector/telemetry/audit evidence through platform
Views, and swap one provider implementation without changing kit code. A
provider-backed pilot is then a conformance exercise, not a new runtime design.

The target deliberately does not include a generalized agent framework,
workflow engine, graph/chain abstraction, universal connector marketplace, or
mandatory external identity/voice account. Those can be added behind the
contracts after the local beta path is reliable.

## Why the target changed

The previous plan treated Entra, Twilio, live collectors, and pilot SaaS
choices as near-term gates. The demo proved that the local voice loop and
persisted tool calls are the valuable product proof; the external call seam is
not the right dependency for validating KitStack itself. Making credentials a
prerequisite would slow iteration and obscure whether failures are in KitStack
or in a provider account.

The new ordering validates the reusable shapes first:

```text
local contracts + mocks -> local dashboard evidence -> durable bindings
        -> kit/plugin reuse -> optional provider conformance -> pilot beta
```

The connector research in
`.track/docs/saas-connector-integration-research.md` recommends Nango for a
first provider-backed pilot and Pipedream Connect for long-tail coverage, but
neither becomes the KitStack agent runtime or registry.

## Workstreams

| Workstream | Purpose | Tickets | Order | Parallelism |
|---|---|---|---|---|
| W0 Ledger and acceptance | Reconcile merged implementation with external gates | Closed review tickets; T-0201/T-0203/T-0204 remain external | Now | Sequential PM cleanup |
| W1 Governance closure | Ensure local `serve()` and router paths enforce grants identically | T-0226 | 1 | Blocks the local beta gate; no provider dependency |
| W2 Provider seam harness | Fake OIDC, voice, OTLP, and connector transports with realistic failures | T-0227 | 1, parallel with W3 | Disjoint test/fixture scope |
| W3 Connector contract | Reusable mock connector factories and contract/conformance tests | T-0229 | 1, parallel with W2 | Depends on T-0202/T-0225; no SaaS account |
| W4 Operator evidence | Make registry, proxy, observability, FinOps, and audit Views provable from fixtures | T-0228 | 2, after W1; parallel with W5 | Can use W2 fixtures and existing platform kit |
| W5 Durable capability bindings | Persist registry metadata, provider selection, scopes, and binding lifecycle locally | T-0230 | 2, after W1/W3 | Parallel with W4; storage-focused write set |
| W6 Product learning | Turn debrief teaching into reusable guidance and memory without building an agent framework | T-0216, T-0218, T-0124 | 3 | T-0216 and T-0218 parallel; T-0124 after local agent fixture |
| W7 External conformance | Validate chosen real identity, voice, collector, CRM, and calendar seams | T-0201, T-0203, T-0204, later T-0231 | 4 | Independent after W2/W3; intentionally not critical path |
| W8 Pilot operations | Customer onboarding, deletion/compliance posture, outage/revocation, KPI cadence | T-0221, T-0222, T-0213 external rehearsal | 5 | Starts only after pilot/provider choice |
| W9 Builder and long tail | Config/generated Kit Builder and provider-backed connector infrastructure | T-0219, T-0220, T-0232 | 6 | After W3/W5; optional for first beta |

## Ordering and gates

### Stage A — local beta gate

Execute T-0226 first. In parallel, execute T-0227 and T-0229. The exit gate is
that a local kit invocation, HTTP/schedule trigger, daemon/voice simulator, and
MCP request all use the same identity/grant behavior; provider faults are
deterministic and observable; no secret or content enters metadata telemetry.

### Stage B — operator proof

Once Stage A is green, execute T-0228 and T-0230 in parallel. The exit gate is
one local run that shows registry/binding selection, proxy/connector activity,
per-app cost/usage, trace/audit status, and org scoping in platform Views. The
screens must be source-backed; seeded fixtures are labelled as fixtures.

### Stage C — reusable kit proof

Execute T-0216 and T-0218 in parallel, then T-0124 as the second real
`defineAgent` customer. The exit gate is one capability reused by another kit
through the SDK contract, with no debrief-specific provider import and no new
planner/chain abstraction.

### Stage D — optional external pilot

Only after local conformance passes, choose the actual CRM/calendar and
identity/voice/collector providers. Run T-0201, T-0203, T-0204, and the
external part of T-0231. If a provider is unavailable, the local adapter
remains the supported beta path.

## Ticket priority after reconciliation

### P0 — execute next, local only

- **T-0226 — critical:** pass `checkAuthz` through SDK `serve()` and add parity
  tests for `serve()`, router, HTTP, schedule, and daemon paths.
- **T-0227 — high:** deterministic external-provider seam harness with local
  OIDC, voice, OTLP, CRM/calendar-shaped fixtures, and fault injection.
- **T-0229 — high:** connector mock factory and contract tests covering health,
  read/write/invoke/subscribe/sync, scope checks, pagination, retries, and
  normalized errors.
- **T-0228 — high:** platform dashboard evidence against local fixtures,
  including registry, connector/proxy activity, observability/trace, FinOps,
  and audit status with org/app filtering.
- **T-0230 — high:** local durable registry and binding lifecycle for provider
  metadata, scopes, secret references, capability versions, and revocation.

### P1 — beta capability, after P0

- **T-0216 — high:** signed guidance overrides, staged rollout, and scoring.
- **T-0218 — high:** reusable memory kit with explicit scope/ownership and
  cross-org isolation.
- **T-0124 — high:** second real non-voice `defineAgent` kit/customer.
- **T-0219 — medium:** Kit Builder configuration tier.
- **T-0221 — medium:** compliance/deletion/control mapping package, when a pilot
  requires it rather than as a local-demo prerequisite.

### P2 — external or optional expansion

- **T-0201 — low/external:** real Entra tenant, consent, user, and revocation
  evidence; local issuer coverage is already closed in T-0160.
- **T-0203/T-0204 — low/external:** CRM and calendar only after the pilot names
  its providers; do not build both prematurely.
- **T-0231 — low/external:** live Twilio, OTLP/SIEM, and deployed rollback/
  restore conformance.
- **T-0222 — low/external:** live pilot onboarding, KPI cadence, and customer
  operations.
- **T-0220/T-0232 — low:** generated Kit Builder and provider-platform adapters.

## Parallelism rules

- The PM may run at most two bounded implementation agents because local CPU is
  constrained; a research agent does not run concurrently with implementation
  agents unless it is read-only and short-lived.
- Parallel tickets must have disjoint write scopes. W2 owns fixtures/harnesses;
  W3 owns connector contracts and test factories; W4 owns platform Views/tests;
  W5 owns binding persistence/migrations.
- Every merge updates the ticket's status and evidence before the next fan-out.
- No external credentials, network provider, or deployment stage is required
  to start or complete P0.
- Do not add a second registry, provider-specific kit imports, orchestration
  graph, chain, planner, or model-router framework as a shortcut.

## Definition of beta-ready

KitStack is ready for a controlled beta when:

1. Stage A and Stage B gates pass locally from a clean checkout.
2. A developer can define a kit, select a mock capability binding, run it, and
   inspect the resulting metadata-only evidence.
3. Revocation and org scoping fail closed in all local transports.
4. The debrief demo remains green after the reusable connector and registry
   work.
5. External-provider tickets are either evidenced for a named pilot or remain
   clearly labelled as deferred; they do not masquerade as local coverage.
