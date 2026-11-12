# Review: KitStack Beta Execution Plan

**Reviewing:** `.track/docs/kitstack-beta-execution-plan.md` (16 Sep 2026)
**Reviewed on:** 16 Sep 2026, branch `dev` at `5198b76`
**Purpose:** verify the plan's repository and tracker claims, list defects and required edits, record the decisions it leaves open, and map the result onto tickets.

Tags: `VERIFIED` checked against the repository. `DEFECT` the plan is wrong or under-specified. `EDIT` a concrete change folded into the ticket text. `DECISION` a choice recorded so implementation can start.

---

## 1. Verdict

The plan's target (§3), constraints (§5), workstream order (§6), gates (§7), cut line (§8), and decision table (§9) are sound and consistent with the roadmap and with the code. The sequencing rule that nothing becomes a platform feature before it passes through the dispatch core is the right spine, and the plan is honest about the live phone call.

It has one blocking defect and six material gaps. The blocking defect is that the recurring verification gates in §11 do not exist: three of the four package suites the plan names as gates fail today, and none of them has a test script. Everything in W1 onward is gated on a baseline that cannot currently be measured. That becomes the first ticket. The six gaps are folded into ticket text below. The plan has no timebox at all; §6 below maps its gates onto the roadmap calendar.

The plan's own §12 says not to create the full backlog before W1 and W2 are accepted. This review creates the full map anyway, with dependency edges and gate labels, because a backlog with `depends_on` is the plan in executable form and `track next` will not surface a G2 ticket while its G1 dependency is open. Nothing past G1 should be claimed until G1 is green.

---

## 2. Repository and tracker claims — verification results

| Plan claim | Status | Precision added |
|---|---|---|
| Duplicate framework and kits removed from `packages/mcp-server`; `packages/demo` removed | VERIFIED | `packages/mcp-server/src` has `router`, `app-data`, `db`, `relay`, `kill-switch`, `scripts`, `shared`, `test`. No `framework/` or `kits/`. `web/src` has no remaining `mcp-server/framework` import. |
| `defineTool` still `(db, args, ctx)` | VERIFIED | `packages/sdk/src/define-tool.ts:23`. |
| `serve()` does not pass authorization into local execution | VERIFIED | `localAdapter` accepts `checkAuthz` (`server/adapters/local.ts:23`), `runtime/mcp-handler.ts:95` threads it, `server/index.ts` never sets it. |
| `packages/authz` is marketplace-shaped | VERIFIED | `Relation = subscriber \| activator \| author`, `ObjectType = subscription \| kit \| review` (`authz/src/types.ts:2-3`). 45/45 tests pass. |
| SDK has no storage dependency and no jobs | VERIFIED | Dependencies are `esbuild`, `picocolors`, `tsx`. No `defineJob` anywhere in `packages/sdk/src`. |
| `defineAgent` emits no per-turn tokens or cost | VERIFIED | `turn_finished` carries `outcome` and `durationMs` only (`define-agent.ts:328-337`). |
| Debrief suite is 136 tests | VERIFIED | 26 files, 136 passed. Typecheck clean. |
| Referenced tickets exist | VERIFIED | `T-0111`, `T-0122`, `T-0124`, `T-0125`, `T-0134`, `T-0141`, `T-0159`, `T-0160` all present, all `backlog`. |
| adint is a usable second kit | PARTLY | Stage A read surface exists: 5 tools, 3 views, seeded store. Zero test files. `list_triggers` and `get_trigger` return empty. `T-0122` is still `backlog` although its README says Stage A is buildable; status is stale. |
| Production OAuth, View publishing, health, and provider credential checks exercised | NOT VERIFIABLE FROM REPO | Recorded in `T-0194`'s work log and the runbook. Accepted as recorded. |
| §11 recurring gates: `npm run test:run`, SDK tests, router/authz tests, web tests | DEFECT | See §3.1. |

---

## 3. Material defects

### 3.1 The verification gates do not exist — DEFECT, blocking

`npm run test:run` at the root runs only the debrief workspace. `packages/sdk`, `packages/mcp-server`, and `packages/authz` have no `test` script. Run directly with Vitest today:

| Package | Result | Cause |
|---|---|---|
| `packages/authz` | 4 files, 45/45 pass | — |
| `packages/sdk` | 2 of 16 files fail, 8 tests | `deploy-seed-registry.test.ts`: fixture schema lacks `migration_sql` column (registry schema drift). `mcp-handler.test.ts`: two assertions on unknown-method rejection and `kit_view` embedded resource. |
| `packages/mcp-server` | 6 of 9 files fail | Tests import modules that resolve SST links at import time; without `sst dev --` they throw "SST links are not active". `app-token` and `oauth` tests additionally need `MCP_JWT_SECRET`. |
| `web` | 10 of 16 files fail | Unresolved imports: `@/test/db-helpers`, `@/lib/authz`, `@/db/schema`, `@/app/page`. Files were moved or deleted without updating tests. |

Every W1+ acceptance criterion says "all maintained kits build and test" or "router/authz tests remain green". Those sentences are unfalsifiable until the baseline is restored. `EDIT`: new ticket **W0-T2**, priority critical, no dependencies, gating W1-T1: restore all four suites to green or explicitly delete dead tests, add `test` scripts to the three packages, make root `npm test` run every workspace, and record the counts. This is the definition of "compile check" and "test check" for every later ticket.

### 3.2 `KitContext` drops `session` — DEFECT, DECISION

W1-T1's context is `{ db, connectors, identity, channel, telemetry, audit, log }`. The roadmap (§2, §8.2) makes a session shared across channels a primitive, the demo host's plugin context already carries `requestId`, `traceId`, `parentId`, and W6-T1's telemetry record requires `session_id`, `trace_id`, `parent_id` on every event. A tool that cannot read its session cannot emit a correlated event.

`DECISION`: add `session: { id, traceId, parentId? }` to `KitContext` in W1-T1. Instructions and memory stay out of `ctx`; they remain kit-facing capabilities resolved at composition, as `DebriefCapabilities` does today, because most kits never need them and putting them on every tool's context is the drift the plan warns about.

### 3.3 W6 telemetry needs W3 identity types before W3 exists — DEFECT

W6-T1's required fields include `principal`, `actor`, `delegation?`. The plan schedules W6 schema work in parallel with W2, and W3-T1 later. `EDIT`: `RequestIdentity` in W1-T1 already carries `{ principal, actor, delegation? }` as types, with the demo's user and service identities as the only producers. W3 widens the producers; the shape is frozen in W1. W6-T1 depends on W1-T1 only.

### 3.4 W2-T1 acceptance names channels that do not exist yet — EDIT

"Tool, loader, job, trigger, voice, and proxy calls share the envelope" cannot be accepted at G1 because jobs (W5-T1), the trigger contract (W5-T2), and the proxy channel are later work. `EDIT`: W2-T1 defines the envelope as channel-agnostic and is accepted when MCP tool and loader calls, the HTTP trigger, and the debrief scheduler's internal invocation (which exists today) go through it under both `serve()` and the router. W5 tickets each add a conformance test for their channel against the same envelope.

### 3.5 W3-T2 has an external dependency the plan treats as engineering — DEFECT

"An Entra user can connect Claude through the existing router" needs a tenant, an app registration, and an admin consent, none of which the repository can produce. This is the same shape as the phone smoke. `EDIT`: split into **W3-T2a** (OIDC federation code: issuer and tenant allowlists, JWKS validation, Protected Resource Metadata, user mapping, delegated identity, tested against a local issuer) and **W3-T2b** (operator gate: tenant, consent, one real Entra user). Protected Resource Metadata is named explicitly; every MCP gateway compared on 16 Sep advertises it and Claude's connector flow expects it.

### 3.6 W7 never names the deployable artifact — DEFECT

W7 says "signed kit/build artifacts" and "the same artifact works locally and in the selected beta deployment target" without saying what the artifact is. The roadmap (§5 step 11) is explicit: a container image, produced by `kit build`, run by compose, Fargate, or Kubernetes, with kit authors never writing a Dockerfile. `EDIT`: **W7-T1** is the container build and the one deployment file. CLI verbs and operations runbooks follow it.

### 3.7 W4-T2 and W5-T3 have hidden dependencies — EDIT

- W4-T2 bundles five connectors. Twilio voice already exists as an adapter under `kits/debrief/src/adapters/voice`. `EDIT`: **W4-T2a** defines the `Connector` interface and ports Twilio voice and SMS as the first instance and REST/OpenAPI as the second; two instances prove the interface. HubSpot and calendar are separate tickets blocked on pilot discovery, so an unused connector is never built.
- W5-T3's acceptance requires "an additional non-voice agent (adint enrichment)", which is W10 and `T-0124`. `EDIT`: W5-T3 is accepted with an SDK fixture agent and the debrief voice loop emitting per-turn metadata; `T-0124` remains the second real customer and depends on W5-T3, not the reverse.

### 3.8 W8 and W11 are workstreams, not tickets — EDIT

W8 lists nine platform apps under one heading; W11 lists ten deliverables, half of them non-engineering with lead time measured in meetings. `EDIT`: W8 splits into the host contract freeze, the platform kit tools and Views, and the shell host with adint as first tenant. W11 splits into a compliance package that starts at G1 (consent, deletion, works-council posture, control mapping) and a pilot operations package at G4. Starting consent and deletion at G4 repeats the risk the roadmap already named.

---

## 4. Smaller edits applied to tickets

- **W1-T2 emits MCP annotations.** `mode: "assist" | "act"` also surfaces as `readOnlyHint` and `destructiveHint` on the MCP tool definition, so bring-your-own servers and SDK kits look the same to any client and to any gateway in front.
- **W6-T1 adopts W3C trace context.** `trace_id` and `parent_id` are `traceparent`-compatible and an inbound `traceparent` is honored, so KitStack's scheduler, voice, and memory spans join a gateway's trace tree.
- **W2-T2 depends on W3-T1.** `kit:act` cannot be enforced before the relation exists.
- **W9-T2 reuses `T-0129`.** The adint LLM connector port is roadmap decision 3d and is the provider seam declarative routing sits on.
- **`T-0159` folds into `T-0194`.** One provider smoke, one evidence log.
- **Out-of-plan tickets are parked, not deleted.** `T-0109`, `T-0110`, `T-0117`–`T-0121` (freelancer kit, VPC removal, re-theme) predate the pivot and are not on the beta path. `T-0109` (owner-only deploy) is superseded by W7-T2's deploy approval.

---

## 5. Things that are correct and were kept unchanged

- §3.3 beta gate, §5 constraints 1–10, §8 cut line and deferrals, §9 decisions, §10 risks.
- The hard break of `defineTool` at 0.2.0.
- The specialized debrief voice loop stays specialized until a stream-native connector is proven; `defineAgent` proves itself elsewhere first.
- Declarative `model: "auto"` before any learned routing.
- Metadata-only telemetry with a separate audit store.

---

## 6. Timebox — DEFECT, mapped onto the roadmap calendar

The plan has no dates. The roadmap's stage gates are fixed: MVP by December 2026, Beta January–June 2027. Mapping the plan's gates onto that calendar, with the previous slice's throughput (T-0142→T-0195 in roughly three calendar days of agentic work for a bounded scope) as the only measured rate:

| Gate | Content | Target |
|---|---|---|
| G0 | W0-T1 phone rehearsal, W0-T2 test baselines | end of September 2026 |
| G1 | W1, W2 | end of October 2026 |
| G2 | W3, W4-T1, W4-T2a, W5, W6, W7 | mid-December 2026 (the MVP gate) |
| G3 | W8-T1 host contract freeze | January 2027 |
| G4 | W8-T2/T3, W9, W10, W11, pilot live | June 2027 (the Beta gate) |

G2 is the crowded one. If it slips, cut W7-T2 CLI verbs and W6-T2 SIEM export before cutting W3, W6-T1, or W6-T3; the plan's own §8 says identity and the eval baseline are release blockers.

---

## 7. Ticket map

New tickets T-0196 through T-0222 were created in `backlog` with `track create --no-claim` on 16 Sep 2026. Existing tickets are reused where the plan names them; their dependencies and labels are updated through the CLI. Gate labels: `G0`–`G4`. Priority: `critical` on the spine, `high` for G2 and G3, `medium` for G4, `low` for the generated Kit Builder tier.

| Workstream | Ticket | Title | Depends on |
|---|---|---|---|
| W0 | T-0194 (existing) | Production demo rehearsal and rollback-safe release; absorbs T-0159 | — |
| W0 | T-0196 (W0-T2) | Restore package test baselines and root test gate | — |
| W1 | T-0197 (W1-T1) | SDK v0.2 `KitContext` contract with identity and session | T-0196 |
| W1 | T-0198 (W1-T2) | Migrate maintained kits; `mode`, classification, MCP annotations, partial-args describe | T-0197 |
| W2 | T-0199 (W2-T1) | Dispatch core shared by `serve()` and the router, with manifest passthrough | T-0197 |
| W2 | T-0209 (W2-T2) | Enforce assist/act, deny lists, and service-identity boundaries | T-0199, T-0200 |
| W3 | T-0200 (W3-T1) | Platform authorization relations, subjects, version counter, revocation latency; absorbs T-0114–T-0116 | T-0197 |
| W3 | T-0160 (existing) | OIDC/Entra federation code with Protected Resource Metadata (W3-T2a) | T-0200 |
| W3 | T-0201 (W3-T2b) | Operator gate: Entra tenant, consent, real user connects Claude | T-0160 |
| W4 | T-0125 (existing) | Storage adapter contract; libSQL first; absorbs T-0130 object store | T-0197 |
| W4 | T-0202 (W4-T2a) | `Connector` interface; Twilio voice/SMS and REST/OpenAPI as first two instances | T-0197 |
| W4 | T-0203 (W4-T2b) | Pilot CRM connector, blocked on pilot discovery | T-0202 |
| W4 | T-0204 (W4-T2c) | Calendar connector, blocked on provider decision | T-0202 |
| W5 | T-0111 (existing) | `defineJob`, job manifests, leases; absorbs T-0112, T-0113 | T-0199 |
| W5 | T-0206 (W5-T2) | Trigger and channel contracts; daemon mode | T-0199 |
| W5 | T-0207 (W5-T3) | `defineAgent` v2 per-turn metadata; fixture non-voice agent | T-0197, T-0205 |
| W5 | T-0124 (existing) | adint brand-enricher as the second `defineAgent` customer | T-0207, T-0129 |
| W6 | T-0205 (W6-T1) | Durable metadata-only telemetry contract, OTel export, W3C trace context | T-0197 |
| W6 | T-0208 (W6-T2) | Append-only hash-chained audit store and SIEM export | T-0205, T-0199 |
| W6 | T-0210 (W6-T3) | `createEval` harness in CI and pilot KPI baseline; absorbs T-0141 | T-0198 |
| W7 | T-0211 (W7-T1) | Container build artifact and one deployment file | T-0199 |
| W7 | T-0212 (W7-T2) | CLI verbs: eval, grants, connectors bind, add skill; deploy request and approval; supersedes T-0109 | T-0211, T-0200, T-0210 |
| W7 | T-0213 (W7-T3) | Operations: health, rollback, migration, key rotation, backup/restore rehearsed | T-0211 |
| W8 | T-0214 (W8-T1) | Freeze the View host contract | T-0198 |
| W8 | T-0215 (W8-T2) | Platform kit v0 over platform telemetry and grants | T-0205, T-0200, T-0214 |
| W8 | T-0134 (existing) | Shell dashboard host with adint as first tenant | T-0214, T-0215 |
| W9 | T-0216 (W9-T1) | Guidance overrides, staged rollout, per-version scoring | T-0205, T-0210 |
| W9 | T-0217 (W9-T2) | Declarative `model: "auto"` v0 with routing reason; builds on T-0129 | T-0205, T-0207 |
| W9 | T-0218 (W9-T3) | Memory kit v0 | T-0200, T-0125 |
| W10 | T-0126 (existing) | adint second-kit dogfood epic | T-0198, T-0125, T-0111, T-0124, T-0134, T-0210 |
| W10 | T-0219 (W10-T2) | Kit Builder config tier | T-0202, T-0210 |
| W10 | T-0220 (W10-T3) | Kit Builder generated tier | T-0219 |
| W11 | T-0221 (W11-T1) | Compliance package: consent, deletion, works-council posture, control mapping | T-0205 |
| W11 | T-0222 (W11-T2) | Pilot operations: onboarding, support, incident, isolation and revocation tests, KPI cadence | T-0201, T-0213, T-0221 |

---

## 8. Decisions recorded

1. `KitContext` includes `session: { id, traceId, parentId? }`. Instructions and memory stay as composed capabilities, not context fields.
2. `RequestIdentity = { principal, actor, delegation? }` is frozen in W1-T1; W3 only adds producers.
3. The dispatch envelope is accepted at G1 on MCP, HTTP trigger, and the scheduler's internal invocation; each later channel adds its own conformance test.
4. Entra federation is two tickets: code against a local issuer, then an operator gate.
5. The deployable artifact is a container image produced by `kit build`.
6. Twilio and REST are the first two connector instances; CRM and calendar wait for pilot discovery.
7. `T-0159` is closed into `T-0194`. Pre-pivot tickets are parked with a `parked` label.
8. Gates are dated: G0 September, G1 October, G2 mid-December, G3 January, G4 June.
