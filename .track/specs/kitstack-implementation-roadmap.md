# KitStack — Implementation Roadmap

**Companion to `kitstack-north-star-spec.md` v1.0. First written 5 September 2026, revised 14 September 2026.**
The north star says *what* and *why*. This document says *what to build, in what order, and what "done" means at each stage* — and, in this revision, spends more words on *why the order is what it is*, because the order is the part that gets argued about.

Reads alongside `debrief-agent-spec.md` **v0.3** (the Ströer kit, source of most MVP requirements) and `fressnapf-kit-spec.md` (the PoC demo).

The focus is unchanged from the first version: **PoC → MVP → Beta → Production, with the debrief agent as the forcing function and the dispatch core as the spine.** What changed is explained in §12.

---

## 0. How to read this document

Four lanes run in parallel — **SDK · CLI · Router · Kits** — but they are not independent. Almost every item below is blocked by something in another lane, and the ordering is derived from what actually blocks what (checked against the repo), not from the phase list in the north star.

Three terms carry most of the weight, so they are fixed here:

- **Dispatch core** — the one function through which every tool call passes, regardless of where it came from: `dispatch({identity, channel, kitId, cmd, args})`. It resolves the kit, checks identity and grant, applies policy, gates `act` tools, invokes, and writes telemetry and audit. Everything that talks to a kit is a *transport* over it.
- **Channel** — how a call arrives: MCP from a chat client, an HTTP trigger, a webhook, a voice stream, later the LLM proxy. Channels are thin by design; the dispatch core is where the substance lives. Channel is a property of a *turn*, not of a session (§8.2).
- **Instructions / SKILL.md** — *instructions* are what the platform hands a model or tool at runtime; *SKILL.md* is the file where they are authored and versioned. One concept, one source format (§8.5).

When this document says something "falls out" of a step, it means the step produces it as a byproduct — no separate work item.

---

## 1. Current state — corrections to north star §0.1

The §0.1 table is directionally right but wrong in three places that change the plan. Each is stated with its consequence, because the consequence is what alters the ordering.

| §0.1 says | Actually | Consequence |
|---|---|---|
| Registry + entitlements ✔ (single-user) · Grant = "new, replaces entitlements" | `packages/authz` is already a Zanzibar-style tuple store: `authz_tuples(subject_type, subject_id, relation, object_type, object_id)` with the right indexes, plus `check` / `listObjects` / `listSubjects` / `grant` / `revoke`. | **Grants are ~60% built.** What §3.7 asks for is a *widening*, not a rebuild. The `Relation` union is `subscriber\|activator\|author` and `ObjectType` is `subscription\|kit\|review` — marketplace-shaped. Swap in `kit:use\|kit:act\|kit:deploy\|kit:telemetry\|kit:admin\|platform:admin`, add the cache and version counter. Days, not weeks. |
| Runtime: onion router, `serve()` ✔ — one runtime | **There are two.** `packages/mcp-server/src/router/` (Lambda: Dynamo registry, Turso authz, OAuth server, circuit breaker, daily cap, audit) and `packages/sdk/src/server/` (`serve()`: auth adapter → `userId` → protocol handler → adapter). They implement dispatch separately. | **`serve()` is the ungoverned path.** It resolves an identity and then performs no authorization at all. `localAdapter` accepts a `checkAuthz` hook; `serve()` never passes it, so tool `authorize` hooks are silently skipped when self-hosted. Against P7 ("customer VPC is production") this is backwards: the path a customer actually runs is the one without governance. This is the single most important fact in this document. |
| — | `packages/mcp-server/src/framework/` duplicates `defineKit`/`defineTool`, and `packages/mcp-server/src/kits/{crm,expense,meeting,outreach}` duplicates four kits already in `kits/`. Only `scripts/seed-registry.ts` imports them. `deprecated/` holds a third copy. | Every cross-cutting refactor below gets paid **two or three times** until this is deleted. |

Accurate in §0.1: connectors, channels, telemetry/audit stores, dashboard shell, identity tuple, Kit Builder and the eval harness are name-only — verified, no code.

Also true and not in §0.1: `defineTool` is `(db, args, ctx)` with `ctx = {userId, kitId, params}`, and `ProtocolHandler.handleRequest(request, userId)` is MCP-JSON-RPC-shaped down to the signature.

---

## 2. The spine

Five things gate almost everything else. Their order is forced, and each arrow below is a real dependency, not a preference.

```
 0 ─ Delete the duplicate runtime        (mcp-server/src/{kits,framework}, deprecated/)
     └─ every refactor below costs 1x instead of 3x
          │
 1 ─ ctx refactor                        defineTool(ctx, args), ctx = {db, identity, channel,
     │                                   telemetry, audit, log, connectors}
     │  └─ widest blast radius in the codebase: ~60 tools across 6 kits.
     │     Every later capability enters a tool through ctx. Cost scales with
     │     kit count — cheapest it will ever be is now.
          │
 2 ─ Dispatch core                       dispatch({identity, channel, kitId, cmd, args})
     │                                   owns: resolve → grant → policy → invoke → telemetry + audit
     │  └─ serve() and the Lambda router both become thin transports over it.
     │     Until this exists, every governance feature is built twice and every
     │     new channel reimplements identity + authz.
          │
     ├── 3a ─ Channels        MCP (rewire) → Trigger (http, webhook) → Voice → Proxy
     ├── 3b ─ Grants          widen relations/objects → scopes → cache + version counter
     ├── 3c ─ Telemetry/audit two sinks behind ctx.telemetry / ctx.audit
     │        │
     │        └── 4 ─ Platform kit (reads the telemetry schema) — P10 dogfood
     │                 │
     │                 └── 5 ─ Dashboard shell + view host contract (chat | shell)
     │
     ├── Connectors        interface → bind-at-deploy → binding registry
     │                     (parallel to 3; needs only step 1 for ctx.connectors)
     │
     ├── Sessions + Jobs   session shared across channels · one-shot schedules with cancel ·
     │                     async work running alongside a live session · storage adapter
     │                     (all four required by the debrief agent — see §8)
     │
     └── Runtime skills    guidance externalized into files, bundled at deploy, served
                           in-band by the router, logged per version
                           (baseline serving in MVP; overrides + scoring in Beta — §8.5)

 Independent of the spine, can start any time:
   · Eval harness         — needed for "every PR carries the eval table" (§6)
   · View host contract   — a defineView signature change; land before the next 5 views
   · Storefront adapter   — Fressnapf; shaped like Connector so it ports for free
   · Voice latency gate   — debrief M1; can kill the product, so run it first (§8)

 The new primitive (§9):
   · defineAgent          — trigger + LLM connection = KitStack ships the agent loop
                            itself, instead of renting it from the client.
                            v1 loop → v2 observability → v3 agent views → model: "auto"
                            Needs 1, 2 and connectors. Reverses a north star non-goal —
                            deliberately.
```

### Why this order, in plain terms

**Why 0 before anything.** Three copies of `defineTool` means the ctx refactor is done three times or done once and the other two copies rot. There is no scenario where keeping them is cheaper.

**Why 1 before everything else.** The `ctx` refactor touches every tool. Six kits today, one Werkstudent arriving, a sales-rep kit and a platform kit coming. Every capability added later — telemetry, audit, connectors, identity — reaches a tool *only* through `ctx`. Do it at 60 tools, not 300. It has no demo and nothing to show, which is precisely why it slips if it isn't first.

**Why 2 before 3a.** The user-facing ask — "the trigger should be a plugin that accepts HTTP and webhook, should be easy" — is easy *only after* step 2. An HTTP endpoint that invokes a tool is ~100 lines today. A Trigger *plugin* in the P4 sense (fixed identity, kit allowlist, grant check, mandatory audit, `act` gating) is the same ~400 lines that Voice and Proxy each need. Build it once in the dispatch core; then Trigger, Voice and Proxy really are thin. Built before step 2, the trigger becomes a *fourth* parallel implementation of dispatch next to `serve()` and the Lambda router.

**Why the dispatch core is also the security story.** Once it exists, there is exactly one place where "who may do what" is decided, and both deployment paths go through it. That is the sentence a customer's security review wants to hear, and it is currently false.

### The primitives the north star under-weights

`defineJob` appears in §0.1 as "half-built" and in Phase 1 as one line. The debrief agent needs considerably more than cron: per-entity one-shot schedules that can be cancelled and rescheduled, async extraction running *in parallel with* a live voice call, and a state machine persisted across all of it. Its data model (`debrief-agent-spec.md` §5) is DynamoDB single-table, not per-user libSQL — so **storage becomes a plugin** (P4) or the kit runs its own store as a labelled exception.

v0.3's `CallSession` is stronger than "state that outlives a request": *one* session spans the chat exchange, the call it produces, and the review — "the voice agent resumes a session; it never restarts one." That makes **channel a property of a turn, not of a session**, which constrains the shape of the dispatch core and is not in the north star's §3.5 channel model. Get it right at step 2 or retrofit it across three channels later.

---

## 3. Stage definitions

| Stage | Window | North star | Done means |
|---|---|---|---|
| **PoC** | now → mid-Sept 2026 | Phase 0 | Two demos run end to end on a laptop. Numbers written down. Shortcuts allowed and labelled. |
| **MVP** | Oct → Dec 2026 | Phase 1 | One org, self-hosted, governed. A named customer's rep uses a kit and IT can see and revoke it. Ströer proposal submitted. |
| **Beta** | Jan → Jun 2027 | Phase 2 | Real users in one business unit. Non-founders build kits. Measured KPI delta. Compliance mapping exists. |
| **Production** | Jul → Dec 2027 | Phase 3 | Two paying enterprises self-hosting, neither of them Ströer, without founder involvement in the install. |

The stage gates are the only thing in this document that is not negotiable. Items inside a stage can be reordered; a gate that isn't met is not passed.

---

## 4. PoC — now → mid-September

**Gate (north star):** Fressnapf + voice demoed end to end; tokens per call and per Fressnapf query written down.

The gate as originally written did not close by Sun 7 Sept: of its three deliverables, voice and telemetry/platform-kit had no code. The recommendation was to cut the 7th to Fressnapf and take voice by the 15th. **As of 14 September this is open decision 1 and is due now** (§11).

| Lane | Work |
|---|---|
| **SDK** | `ctx.telemetry.event()` stub with a stdout sink — enough to count tokens per call. No breaking change yet. |
| **CLI** | Nothing. |
| **Router** | Nothing structural. Emit a `tool_call` telemetry event with request/response token counts. |
| **Kits** | **Fressnapf**: storefront adapter (`search` / `getProduct` / `getReviews`) with record/replay fixtures, written against a `Connector`-shaped interface so it ports later. Product data moves out of the seed migration and behind the adapter — this is the point of the kit. Then the 4-step script, rehearsed. **Added this revision:** a checkout step against a Stripe sandbox, rendered as a `kit_view` — the moment the stateful-view argument becomes visible instead of explained. Spike first whether the host's view sandbox loads Stripe's script; if not, fall back to a hosted checkout page with the view polling the payment status. Either variant makes the point: card data never enters a tool result. |
| **Voice** | This is debrief **M1** (`debrief-agent-spec.md` §17): Twilio → streaming STT/TTS → interview loop, hardcoded context pack, one hard-coded delegated identity. Bypasses the router. **Label it as a bypass in the demo notes** — it becomes the Trigger+Voice channel in MVP, not before. |
| **Trigger** | A plain authenticated HTTP handler that starts the voice call. Not yet a plugin. |

**M1's gate is the real PoC gate.** p50 ≤ 1.2 s mouth-to-ear, German STT usable with domain vocabulary, barge-in working, tested with road noise and Bluetooth hands-free — not after. Every plan in this document past PoC assumes voice feels good. Nothing else here can invalidate the roadmap; this can. See §8.3.

Deliberately **not** in PoC: ctx refactor, dispatch core, grants, connectors, dashboard. Doing any of them now costs the demo dates and buys nothing a demo shows.

**Write down at the gate:** tokens per Fressnapf query (kit vs. a CRUD baseline), tokens per voice turn, p50/p95 tool latency. These three numbers are the seed of the eval harness and the entire §8 pitch. Without them, every later claim about token efficiency is an opinion.

---

## 5. MVP — October → December 2026

**Gate:** Ströer proposal submitted with a live sales-agent kit, a measured baseline, and the identity/Entra story. Werkstudent hired, first view shipped.

Ordered. Items on the same number can run in parallel. Week numbers are relative to 1 October.

**1. Clear the ground** *(week 1)*
- Delete `mcp-server/src/kits`, `mcp-server/src/framework`, `deprecated/`. Repoint `seed-registry.ts` at `kits/`.
- One `defineKit`/`defineTool` in the repo, in the SDK.

**2. `ctx` refactor** *(weeks 1–2, SDK + all kits)*
- `defineTool({ name, description, mode, classification, args, handler: (ctx, args) => ... })`.
- `ctx = { db, connectors, identity, channel, telemetry, audit, log }`. Shim the `(db, args, ctx)` signature for one minor version, warn on use (or hard-break — open decision 4).
- `mode: "assist" | "act"` on every tool — declared now, enforced at step 4. Declaring it early costs nothing and means enforcement is a one-line change later instead of a migration.
- **Instructions from SKILL.md**: `instructions` is what we hand an agent or a tool; SKILL.md files next to the tool are where they are authored. Reviewed in the same PR as the tool, bundled at `kit deploy`, served with the describe response. See §8.5.
- **Partial-args describe fallback**: a failed `safeParse` returns the tool's instructions and schema instead of a Zod error string (§8.1). Small, but it is the difference between a tool that teaches its use and one that scolds — and it is what makes the dispatch surface competitive with typed native tools (§8.6).
- Migrate all six kits. This is the Werkstudent's onboarding task if they start in October.

**3. View host contract** *(week 2, SDK — parallel with 2)*
- `defineView({ id, loaders, render: (data, host) => ... })`, `host = { kind: "chat" | "shell", size, navigate, identity, theme }`.
- Land **before** the first Werkstudent view and before the platform kit's views, or they get written twice.

**4. Dispatch core** *(weeks 3–5, Router — the critical path item)*
- Extract `dispatch({ identity, channel, kitId, cmd, args })` from `tool-dispatcher.ts` + `protocol.ts`.
- The onion, in order: resolve kit → identity → grant → policy → `mode` gate → invoke → telemetry + audit.
- `serve()` and the Lambda handler both become transports calling it. **Same governance both paths** — this is the item that makes P7 true.
- Fix the open gap: `serve()` must pass `checkAuthz` into `localAdapter`.
- **Passthrough (added this revision, see §8.6):** the dispatch core maps `kit(<server> <tool> …)` onto a plain `tools/call` against a registered MCP server, using a small manifest next to that server. A kit built with the SDK and a bring-your-own MCP server go through the same core; the SDK becomes a convenience, not a requirement. This is a shape decision for step 4, not extra work — it is what the mapping table in the dispatch core looks like anyway.

**5. Grants** *(weeks 3–5, Router — parallel with 4, merges into it)*
- Widen `Relation`/`ObjectType` to the six scopes. Migration from `activator` → `kit:use`.
- Registry version counter + 5–15 min per-process cache. Target: revocation under a minute, measured.
- Roles as grant subjects; group/app-role mapping table for Entra.

**6. Identity** *(weeks 5–7, Router)*
- `{ principal, actor, delegation? }` on every session; the three types (user, service, delegated).
- Router as OAuth 2.1 authorization server with dynamic client registration, federating to Entra. **Do not cut this** — it is the technical objection in every enterprise conversation, and §3.6 is right that it is a feature, not a workaround. The customer's chat client speaks OAuth to KitStack; KitStack speaks to Entra. The client never sees Entra directly.
- It is also a **pilot blocker, not just a proposal talking point**: debrief v0.3 §3 makes a Claude surface wired to the router a hard dependency of the chat flows, so volunteers cannot be onboarded in M4 without it. Pull the Claude.ai custom-connector path forward to the front of this step.
- OBO token exchange for the `m365.graph` connector.
- One-time friction to plan for: an Entra admin has to consent to the KitStack app registration. It's a meeting, not engineering. Put it on the onboarding checklist now rather than discovering it in a pilot.

**7. Channels** *(weeks 6–9)*
- **Trigger, two surfaces one contract** (debrief v0.3 §4.1, §7.1): the kit's MCP tool carries *intent*; the plugin's webhook endpoints carry *transport*. Both converge on the same internal contract, and the scheduler invokes the same tool internally under a service identity with the same validation. That internal-invocation path is exactly the dispatch core — it is why step 4 comes first.
- **Trigger plugin**: `http`, `webhook` (provider-signed), `schedule` (via `defineJob`), `stream` (§8.1). Each declares a fixed identity + kit allowlist; `act` tools require a grant; audit mandatory.
- **Voice**: Twilio Media Streams → realtime adapter → dispatch core, delegated identity, post-call job. Provider behind an adapter from day one.
- **Daemon mode** `serve({ mode: "daemon" })` for voice latency — not optional, see §8.1.

**8. Connectors** *(weeks 6–10, parallel — needs only step 2)*
- `Connector<Config, Client>` interface per §3.3; bind at deploy from an org binding registry; secrets resolved at bind time (P6) via AWS SM / Vault / Azure KV adapter.
- MVP set is dictated by the debrief agent, not by a general shopping list: `hubspot` (CRM write path), `twilio.voice` + `twilio.sms`, `calendar` (Google **or** MS Graph — pick from what the Ströer volunteers actually use), `rest`/OpenAPI import.
- `postgres` and the wider `m365.graph` surface can wait; nothing in the December gate needs them.
- Port the Fressnapf storefront adapter onto `rest` as the interface's second instance — two instances is what proves an interface, one proves nothing.

**8b. `defineAgent` v1 + v2** *(weeks 7–11, SDK + Router — needs steps 2, 4 and the LLM connector)*
- v1: trigger + LLM connection + instructions + tool subset. Scoped to one kit, one trigger (§9.2).
- v2: every loop turn emits a telemetry event with model, tokens, latency, cost, tool calls and outcome — merged into step 9's schema rather than bolted on after.
- First customers: the debrief agent's SMS-keyword and scheduler paths. **Not** the voice interview loop (§9.3).

**9. Telemetry + audit** *(weeks 8–10)*
- Two stores: telemetry (Dynamo + TTL, OTel exporter) and audit (append-only, hash-linked, separate table).
- Schema owned by the platform kit. Aggregate-by-default for employee metrics (Betriebsrat).
- **Metadata only, never bodies (fixed this revision, §8.7).** Telemetry records who, which kit, which tool, tokens, latency, outcome, errors. Prompts, completions and tool payloads are handled in memory to route and count and are never persisted. This is a logging *configuration* the customer can audit, not a promise.
- **Log the skill id + version of every guidance block served in a session** (debrief v0.3 §13). Cheap now, and it is the only thing that makes per-version scoring possible later — retrofitting it means the pilot's sessions are unscoreable.
- **Per-tool struggle metrics (added this revision):** success rate, retries before a valid call, schema-validation failures, repeated identical calls, tokens per successful outcome. All of it is in the call envelope the router already sees, so it is a schema decision, not new instrumentation. It is also the most concrete answer to "how do you optimise tokens in an MCP setup" — a table instead of an opinion.

**10. Kits** *(throughout — the forcing function)*
- **debrief agent** (`debrief-agent-spec.md`) — the Ströer artifact and the source of nearly every requirement above. Its M1–M4 milestones interleave with these steps; see §8.
- **platform kit v0** — sessions, cost per tool, per-tool struggle table. **Chat views only** in MVP (P10 holds without a shell).
- **Fressnapf** — ported to `rest` connector.

**11. CLI** *(weeks 9–12)*
- `deploy` → submits a **deploy request** when the caller lacks `kit:deploy`; admin approves (P8).
- `kit add skill <org/name>@version` against an org-private registry.
- `grants` verbs, `connectors bind`, `eval`.
- **Build artifact is a container (added this revision).** `kit build` layers a kit — SDK-built or bring-your-own — onto one base image. The same image runs in compose locally, on Lambda, Fargate, or a customer's Kubernetes. Kit authors never write a Dockerfile. This is what makes "runs in your VPC" one sentence instead of a runbook, and it is the precondition for §7's "a customer installs it without us".

**12. Eval harness v0** *(any time from week 1; needed by week 10)*
- `createEval`: scenario + CRUD baseline + kit surface → round-trips, result tokens, cumulative context after N turns, task success. Runs in CI, table on every PR (§6).

### Recommended cuts from north star Phase 1

December's gate is a **proposal**, not a rollout. That permits:

| Cut to Beta | Why it survives the cut |
|---|---|
| **Dashboard shell v0** | The platform kit ships chat views. P10 is still satisfied. The shell is 4–6 weeks that buys nothing the proposal needs. |
| **Policy engine** (§3.7) | Ship deny-lists + `act` gating inside the dispatch core. Full YAML rules, argument constraints, classification redaction → Beta. |
| **SCIM** | Group-mapping via Entra app roles is enough for one org. |
| **`salesforce`, `s3`/`sharepoint`, `slack`, `postgres` connectors** | Five connectors prove the interface; twelve prove nothing more. `hubspot` is **not** cuttable — it is the debrief agent's write path. `salesforce` waits on open question 1 in `debrief-agent-spec.md` (Ströer's actual CRM). |
| **Proxy channel** | Already Phase 3 in the north star. Keep it there (§8.7 explains what it becomes). |
| **Memory kit** (§8.8) | Not needed for anything in the December gate. It is the natural extension of instruction serving and belongs after overrides exist. |

Do **not** cut: dispatch core, grants, identity/Entra, trigger, voice, eval harness. Each is either the critical path or the thing the buyer asks about first.

---

## 6. Beta — January → June 2027

**Gate:** sales agent live in ≥1 unit with measured KPI delta; compliance mapping exists; one non-Ströer enterprise evaluating.

| Lane | Work |
|---|---|
| **SDK** | `defineJob` GA (cron + one-shot). App declaration `app: { routes }`. Loader/host primitives stabilised — this is the API third parties code against, so it freezes here. **`defineAgent` v3 — agent views** (§9.3): the agent fetches a render of its own output through the existing view pipeline. |
| **Inference** | **`model: "auto"` v0 — declarative routing** (§9.4): per-task-class model selection, the debrief config's hand-written `conversation`/`extraction` split generalised. Routing decisions emitted as telemetry with their reason. Learned classifier begins collecting against the flywheel's scores. |
| **CLI** | `kit deploy` publishes the kit's dashboard app. Skill registry: publish, sign, version-pin. Kit Builder tiers exposed as CLI-invoked skills. `kitstack up` (compose) and `kitstack deploy --target` read the same deployment file. |
| **Router** | Policy engine (YAML: deny lists, argument constraints, classification redaction, per-identity rate limits). OTel export to customer collectors. SIEM export of the audit chain. Cost attribution per intent per team. **Runtime-guidance overrides**: override store, staged rollout, contract-version pinning, promote/expire, per-version scoring (§8.5) — the flywheel in `debrief-agent-spec.md` §14 is its first consumer. **Dispatch ranking (§8.6):** the `kit()` description is ordered per caller from role and recent tool sequence; held stable within a session; hit rate measured. |
| **Kits** | Platform kit apps: sessions & cost, grants editor, connector bindings, deploy queue, per-tool struggle table. Second and third department kits — **built by the Werkstudent or a partner, not the founder**, that is the actual test. **Memory kit v0** (§8.8), first as the founder's own dogfood across repos. |
| **Dashboard** | Shell: auth via router OAuth, routing, app registry, primitives (table, chart, timeline, form, grant editor). Kit apps visible by grant. URL-per-app (`mcp.<org>/<app>`) as a filtered view of one router, so an app is shared by sending a link. |
| **Connectors** | `hubspot`, `salesforce`, `s3`/`sharepoint`. SCIM provisioning. A stdio→streamable-HTTP wrapper in the harness, so the long tail of local MCP servers is deployable as-is. |
| **Kit Builder** | Config tier (connector + template, no code) and generated tier (introspect OpenAPI/schema → propose workflow tools → generate → test → eval → PR). Hard rule: generator refuses endpoint mirrors (P1). |

Beta's real risk is not features — it is that **the shell and the kit-app contract are a public API**. Once a third party ships an app against it, the primitives freeze. Spend the design time in January, not April.

---

## 7. Production — July → December 2027

**Gate:** two paying self-hosted enterprises → spin-off candidate.

| Lane | Work |
|---|---|
| **SDK** | Semver contract and deprecation policy. Signed kit packages. |
| **CLI** | Self-serve config kits from the shell. Signed community connectors and skills, signature verification on install. |
| **Router** | Proxy channel beta (§8.7): KitStack as reverse proxy in front of LiteLLM, OpenAI-compatible; identity, attribution and priority added at the edge; LiteLLM's routing/fallback configured through its API from telemetry, on a cadence, with hysteresis. Shared/org-keyed DB path — per-kit SQLite per user does not survive org scale. HA/upgrade story for a customer VPC install. |
| **Inference** | **`model: "auto"` learned routing** (§9.4): classifier trained on per-org scored inference, always degrading to the declarative policy on cold start. Cost-reduction reporting per kit and per team — the FinOps close. |
| **Ops** | SBOM for the runtime. Compliance mapping (ISO 27001 A.5/A.8, BSI Grundschutz APP/ORP, NIS2 Art. 21) — document, don't over-claim. Install runbook a customer's IT can execute without us. |
| **Commercial** | License motion live; tiering by live kits + connected identities validated against two signed contracts. |

The production bar that is easy to miss: **a customer installs it without us**. Everything above is downstream of that sentence, and the container build in §5 step 11 is what makes it possible.

---

## 8. Triggers, voice, the debrief agent — and the platform surfaces they force

### 8.1 The trigger: two surfaces, one contract

v0.3 splits the trigger in a way that matters. **The MCP tool carries intent; the plugin carries transport.** `initiate_call(rep, purpose, account, meeting, channel?, when?)` is the single contract, with three callers — the rep's Claude over MCP, the scheduler by internal invocation *under the same validation*, and an SMS keyword parsed into the same call.

That middle caller is the whole argument for building the dispatch core first. "Internal invocation, same validation" is precisely `dispatch({identity: service, channel: "trigger", kitId, cmd, args})`. Without a dispatch core, the scheduler either re-implements validation or bypasses it — and a scheduler that bypasses grant checks is the thing an enterprise security review is looking for.

**Progressive disclosure to the parameter level already exists.** `kit(id, cmd)` with no params routes to `handleDescribe` in `packages/sdk/src/server/kit-router.ts` and returns the tool's instructions, its schema, and how to run it — instructions, not an error. `initiate_call` needs no new primitive for the common case.

One narrow gap: a *partially* filled call skips describe and reaches `executeTool`, where a failed `safeParse` returns `Invalid arguments: account: Required` with `isError: true` — a Zod string rather than guidance. Route that failure back through the describe path so a partial call is answered the same way an empty one is. Roughly 20 lines in `localAdapter` plus the same in the Lambda dispatcher. Do it once the dispatch core exists (step 4) so it lands in one place instead of two.

The per-parameter resolution guidance itself — "resolve `account` against the `account_context` view; if ambiguous, ask which customer this meeting is about" — is not code. It is **instructions**, authored in a SKILL.md next to the tool and served with the describe response. See §8.5.

**Requested: HTTP + webhook ingress, "should be easy".** For transport, yes — split in two, because only half is easy, and `debrief-agent-spec.md` §4.1 adds a kind that isn't easy at all.

*The easy half (PoC, ~100 lines):* an authenticated HTTP handler that resolves a kit, calls a tool, returns the result. Enough to start a voice call this month.

*The half that is the actual work (MVP step 7):* the plugin *contract*.

```ts
defineTrigger({
  id: "after-meeting",
  kind: "http",                       // "http" | "webhook" | "schedule" | "stream"
  identity: { type: "service" },      // or delegated, time-boxed
  kits: ["debrief"],                  // allowlist — the trigger cannot reach past it
  verify?: (req) => boolean,          // provider signature: X-Twilio-Signature,
                                      // Graph validation token, Google channel token
  handler: async (ctx, payload) => { ... },
});
```

Every field there is a dispatch-core concern: identity minting, kit allowlist, grant check, `act` gating, mandatory audit. Voice needs the identical set. Proxy needs it again. That is why the trigger lands *after* step 4 and not before.

Route ingress at `POST /t/<kit>/<trigger>`, matching the debrief spec's `/t/calendar`, `/t/voice/status`, `/t/sms/inbound`, `/t/tick`, `/t/manual`. Unsigned → 403, no side effects.

**The kind that is not easy:** `WS /t/voice/media` — a bidirectional PCM stream for the length of a phone call. This is not request/response, so it does not fit the Lambda router at all. It forces daemon mode (or Fargate) into MVP as a hard requirement, not a nice-to-have. `debrief-agent-spec.md` open question 5 defers Fargate-vs-long-running-Lambda to M1 — that is the right place to decide it, but the *runtime* must support a long-lived session either way, and `serve({ mode: "daemon" })` is how KitStack expresses that. With the container build (§5 step 11) the difference between the two is a deploy target, not a code path.

### 8.2 The debrief agent does not fit today's kit model

This matters more than any single feature. As specced, the agent is an event-driven, stateful service: a lifecycle state machine (§7.2), one-shot EventBridge schedules created and cancelled per debrief, extraction running asynchronously *alongside* a live call, a DynamoDB single-table store, and a latency-bounded media loop where tool calls are forbidden (§9: the context pack is precomputed; only `end_call` and `schedule_callback` exist in-loop).

A KitStack kit today is a stateless request-response tool handler over per-user libSQL. Every one of those properties is missing — and v0.3 adds in-band instruction serving on top.

That gap is the opportunity, and also the trap. **Fressnapf was supposed to prove the API plugin type and instead shipped as seeded SQLite with no adapter** — the boundary it existed to prove was skipped because a demo doesn't show the difference. The debrief agent would skip six boundaries the same way, and it is the kit that Phase 1's entire platform surface is supposed to be derived from. If it gets built beside the SDK rather than through it, MVP ends with a working sales demo and no platform.

Concretely, build these *as SDK primitives* while building the agent:

| Agent need | SDK primitive | Falls out as |
|---|---|---|
| `CallSession` spanning chat → call → review | session identity shared **across channels**; channel is a property of the turn | Voice + Proxy both need it; north star §3.5 doesn't model it |
| Schedule at `end + buffer`, cancel on state change | `defineJob` with one-shot + cancel, not just cron | north star §3.4 `schedule` trigger |
| Extraction in parallel with the live call | async work attached to a session | any long-running kit |
| DynamoDB single-table | storage adapter (P4) | org-scale DB path (north star §10) |
| Context pack assembled at schedule time | loader-shaped precompute, not in-loop tools | the reason voice hits its latency budget |
| Instructions in versioned files, served in-band | SKILL.md → instructions (§8.5) | a platform product surface of its own |
| CRM/calendar/Twilio access | connectors (step 8) | the whole integration library |

### 8.3 Milestone interleave

The debrief agent's M1–M4 and the MVP steps in §5 are the same calendar. Rough fit:

| Debrief milestone | Runs against | Lands |
|---|---|---|
| **M1 — call core** (latency, German STT, barge-in, car-noise) | Nothing platform-side. Hardcoded context pack, no router. | **Now — before or during PoC.** Run it first: the p50 ≤ 1.2 s gate can kill the product, and every platform decision after it assumes voice works. |
| **M2 — entry loop** (extraction, HubSpot commit, SMS, patches, **guidance served from skill files with version logging**) | `hubspot` + `twilio.sms` connectors, `act` mode, skill bundling + serving | Oct–Nov, alongside MVP steps 2, 8 and 9 |
| **M3 — trigger loop** (`initiate_call` with progressive discovery, chat frontloading + session resume, scheduler, SMS keyword, prep brief; calendar best-effort) | instructional params, trigger plugin, `defineJob` one-shot, cross-channel session, MCP views via router | Nov, needs MVP steps 4, 6 and 7 |
| **M4 — pilot** (3–5 volunteers, consent, deletion) | grants, identity, audit store, **Claude surface on the router** | Nov–Dec — the December proposal is far stronger with pilot data than with a demo |

**M3 is two demos in one.** Its gate — ask Claude for a briefing, take the call, confirm in chat — is also, per debrief v0.3 §2, the KitStack cross-surface reference demo. One session crossing MCP chat, voice, and an MCP view is the clearest possible statement of the channel thesis, and it is worth more to the platform pitch than any diagram. Weight M3 accordingly.

**Run M1 now.** It is the only item in this document with the power to invalidate the rest of it, it depends on no platform work, and it is cheap: Twilio number, streaming STT/TTS, a hardcoded context pack, a car with road noise. Do it before the ctx refactor starts.

### 8.4 The eval harness gets its first real dataset

`debrief-agent-spec.md` §16 specifies 8–10 scripted rep personas as audio with golden annotations, run on every skill or config version change. That is a better first customer for the eval harness (§5 step 12) than a synthetic token-footprint benchmark, and it is labelled trajectory data of the kind north star §3.11 wants. Build `createEval` against this dataset rather than inventing one.

v0.3 adds a promotion rule the harness has to enforce: an override is promoted **only if the offline suite passes and its live score is ≥ baseline**. That makes the eval harness a gate in a release path, not a reporting tool — design it as something CI can fail on.

### 8.5 Instructions and SKILL.md

**The vocabulary, fixed.** *Instructions* are what we hand an agent or a tool at runtime. *SKILL.md* files are where instructions are authored and versioned. One concept, one source format — and it already matches `defineKit({ instructions })`. North star §3.10's `kit add skill` delivers the files; what the router serves out of them is instructions.

v0.3 §13 externalizes every piece of guidance this way — the interviewer system prompt, the extraction prompt, each resolution instruction a tool returns when its params are unresolved — into files next to the tool they steer, reviewed in the same PR, bundled at `kit deploy`, **served in-band by the router**. Published overrides then update instructions live without rebundling: draft → staged rollout (`rollout_default_pct`) → promoted or expired, pinned to the tool's contract version so a contract change invalidates stale instructions instead of letting them drift. Every session logs the id + version served, which is what makes per-version scoring and zero-client-change A/B possible (§14).

The spec is explicit that override serving, rollout and scoring are **platform scope**, and equally explicit that **baseline-only serving is sufficient for M1–M4**. Take that cut exactly as offered:

| | MVP (by M2) | Beta |
|---|---|---|
| SKILL.md in the repo, next to tools | ✔ | |
| Bundled at `kit deploy`, served in-band | ✔ | |
| Session logs instruction id + version | ✔ (step 9 — cheap now, unscoreable if retrofitted) | |
| Override store, staged rollout, promote/expire | | ✔ |
| Contract-version pinning | | ✔ |
| Per-version scoring + A/B | | ✔ |

Two things that follow, worth stating because they shape later work:

- **Scoring an instruction is not "does it repeat".** The useful metric for guidance is how quickly a model aligns to it — corrections after load, compared against sessions where it wasn't loaded. A vague instruction is never contradicted and therefore scores perfectly while doing nothing; the held-out comparison is what catches that. Design the score that way from the first version.
- **Instructions are a layered set.** Kit-authored instructions are the seed and the fallback. Org-level and user-level layers arrive with the memory kit (§8.8), merged at call time with a fixed precedence and a "locked" flag the kit author controls. Nothing safety- or correctness-relevant is ever overridable from a lower layer.

This is a strong enterprise surface in its own right: governed, audited, versioned control over what your agents are told, with measured rollback. It is CIO-legible, it is not in the north star, and it becomes considerably more valuable once the loop runs on our side too (§9).

### 8.6 Passthrough, the manifest, and why dispatch is worth keeping

**Added this revision.** The onion pattern originally assumed kits are built with the SDK. That assumption is a tax on adoption: nobody rewrites a working MCP server to fit ours. The revised position is that **MCP itself is the interface, plus a manifest** — a small file next to any server declaring what the platform can't infer: which parameters memory may default, which tools are locked versus overridable, which permission class each tool falls in, which namespaces it wants. No code, no imports. The SDK becomes what a database client library is: a convenience that reads the connection strings from the environment. Required for nothing.

What a registered server gets, whether SDK-built or not: identity propagation, grants, the proxy, telemetry, records, state. Handed over as connection strings at deploy.

This changes nothing about the spine — it is the dispatch core's mapping table — but it settles a question devs will ask: *does my server have to speak `kit(crm salesforce customer get --name=foo)`?* No. The shell form is what the **model** sees. The dev's server exposes `get_customer(name)` with a normal schema, and dispatch maps between the two mechanically. Accept JSON arguments as well as flags (`kit("crm/salesforce/get_customer", {"name": "foo"})`), and return the tool's real JSON schema on the first partial call, so the second attempt is a native call in everything but transport.

**Why dispatch stays, given passthrough.** Deferred tool loading, where a model searches a catalogue and reads results, costs a round trip per attempt and the attempts compound in context. The `kit()` description is a *table of contents shaped for this caller* — the model recognises instead of searching. It can be ordered per role and per recent sequence (the Markov table over tool calls that the telemetry produces anyway), held stable within a session, and its hit rate measured: how often the first tool called was one the description led with. That measurement, plus calls-to-first-successful-tool and tokens-to-first-success, is how the claim gets proven rather than asserted. A wrong guess is not free, so hints stay short and the fallback search stays available.

### 8.7 The proxy, and what KitStack does and does not store

**Fixed this revision.** Two decisions that belong together.

*The proxy is a reverse proxy in front of LiteLLM, not a second router.* KitStack's hot path does four things: authenticate, attach identity and priority headers, admission, forward. Model routing, fallbacks, retries and provider keys live in LiteLLM, which already does them; KitStack pushes policy into LiteLLM through its API from telemetry — on a cadence, with hysteresis, never per observation. Reverse-proxy discipline applies: stream bodies, never buffer, keep upstream connections pooled, log asynchronously, reload config by atomic swap. Priority scheduling inside the proxy (token-weighted tickets, aging, admission-only, per team and per agent) is a **feature for customers whose telemetry shows spillover or a runaway agent**, not a pitch line; enterprises don't feel rate limits and will not buy on scarcity.

*KitStack never persists conversations.* The proxy sees prompts and completions in transit and handles them in memory. Telemetry is metadata. What KitStack keeps beyond metadata is what a client compiled and sent back deliberately: skills, and the small structured context that makes a skill make sense — **decision records, knowledge records, specs**. Those are content-hashed so a skill knows when its source changed. This is the design that survives a works council (§87 BetrVG) and a data protection review, and it makes the knowledge pitch honest: "we capture the decision, not the conversation."

Where the proxy sees traffic: everything built on an API (coding agents via a configurable base URL, internal apps, KitStack's own agents, Azure-OpenAI-backed internal chat UIs). Vendor chat products (Claude.ai, ChatGPT Enterprise, Copilot) do not expose a configurable endpoint; from them KitStack sees MCP traffic only. That share shifts toward "everything" as agents multiply, which is the reason the proxy is Phase 3 and not earlier: it earns its keep once the agent population exists.

### 8.8 The memory kit

**Added this revision, placed in Beta.** The natural extension of §8.5: if instructions are versioned files served in-band, then org quirks and per-user preferences are the same object at other scopes. The memory kit stores **skills** — a procedure, the inputs it depends on, preconditions and scope, with `derived_from` edges — not paragraphs of prose. Write path is a round trip: `kit(mem save)` returns the nearest existing skills and a schema; the client model, which holds the conversation, compiles the skill and returns it; KitStack validates (rejecting facts dressed as procedures), normalises, versions, links. `kit(mem load)` filters by applicability, checks that inputs still hold, and returns skills to re-derive against live data — nothing stored is returned as-is.

Why Beta and not MVP: nothing in the December gate needs it, and it depends on the instruction layer, the grant model (skills flow into a kit only through a namespace grant) and the container build (it's the first kit-to-kit dependency, and the right first one because it fails gracefully — a kit without memory still works).

Why it's on the roadmap at all: it is the first open-source, free-to-run reason to install KitStack; it is what makes a kit *personal* without the kit owning the user's data; and its telemetry is the flywheel's raw material — skills that are loaded often and re-derive the same way every time are tools waiting to be written. Validate first on the founder's own repos (a skill compiled in one repo changes behaviour in another without copying), then decide on wider exposure.

---

## 9. `defineAgent` — shipping the loop

### 9.1 Why it is not optional

Today KitStack provides tools and rents the loop from the client. That works for exactly one channel. Every other channel in the north star needs a loop of its own: a trigger that can fire a single tool is a webhook, not an agent; voice needs a loop; the SMS keyword path needs a loop; the debrief interview engine *is* a loop; Proxy is nothing but a loop. The loop is already required four times over in the MVP scope. `defineAgent` is the decision to build it once instead of four times, badly.

```ts
defineAgent({
  id: "debrief-interviewer",
  trigger: afterMeeting,     // §8.1 — the same trigger contract
  model: "...",              // or "auto" — §9.4
  instructions,              // from SKILL.md (§8.5)
  tools: [...],              // a subset of this kit's tools
});
```

### 9.2 It reverses a north star non-goal — say so out loud

North star §7 lists: *"No general agent framework; orchestration belongs to the client or to Jobs."* `defineAgent` is orchestration in the platform. That is a reasonable reversal, but it should be an explicit amendment rather than quiet drift — the non-goal exists to stop scope creep, so the reasoning that justified it has to be *replaced*, not ignored.

The replacement, and the boundary that keeps this from becoming a graph-builder framework:

> **A `defineAgent` loop is scoped to one kit's tools and one trigger.** No cross-kit orchestration, no chains, no graph DSL. We ship the loop only where we own the channel and the client is absent. Anyone wanting general orchestration uses the MCP surface with their own client — which is the product working as designed, not a gap.

Write that into the north star as the amended non-goal in the same edit that adds `defineAgent`. Note the one exception that stays inside the boundary: a kit may *call* another kit through the router (the memory kit is the first case), because that is a dependency, not orchestration.

### 9.3 Staging

| | Scope | Lands |
|---|---|---|
| **v1 — the loop** | trigger + LLM connection + instructions + tool subset | MVP |
| **v2 — observability** | every turn as a telemetry event: model, tokens, latency, cost, tool calls, outcome | MVP (with step 9) |
| **v3 — agent views** | the agent fetches a render of its own output | Beta |

**v1's first customer is not the voice loop.** The debrief interview engine is latency-bounded and specialized — gap computation against an async extraction draft, a phase machine, and deliberately only `end_call` / `schedule_callback` in-loop. A generic v1 loop will not carry it, and pretending otherwise costs M1. v1's real first customers are the SMS keyword path and the scheduler path. The two converge later, once v1 has run in anger.

**v2 is nearly free if done with step 9 and expensive afterwards.** Inference events are the same telemetry pipeline as tool events; the schema just needs the model/token/cost fields from the start. Same argument as logging instruction versions — retrofitting means the pilot's sessions are unanalyzable.

**v3 reuses infrastructure that already exists.** KitStack already renders views: shell, loaders, sandboxed iframe. An agent view is the same pipeline with the agent as consumer instead of the human. It closes the feedback loop for anything visual, incrementally, which is why it belongs in Beta rather than "someday".

### 9.4 `model: "auto"`, and the honest version of it

The chain is: own the loop → see every inference → meter cost, latency and outcome per call → score → classify → route. **The first link is the whole argument.** With the loop in the client you never see inference, so you can never score or route it. This is the strongest strategic reason for `defineAgent`, stronger than the channel argument in §9.1.

Sequence it in four steps, not one:

1. **Own the loop + meter it** — v1 + v2. MVP.
2. **Get a scoring signal** — the flywheel success signals in debrief §14 and the eval harness (§8.4). Beta.
3. **Ship declarative routing first.** The debrief config already has `models: { conversation: <fast>, extraction: <strong> }` — a hand-authored routing policy. `model: "auto"` v0 is that policy made declarative and reusable. Useful immediately, needs zero data, honest about what it does. Beta.
4. **Replace the heuristic with a learned classifier** once there is per-org labelled data. Beta → Production.

Two caveats designed in from the start:

- **Cold start is real.** A classifier needs labelled data per task type *per org*, and a new customer has none. `auto` must always degrade to the declarative policy, never to a guess.
- **"The classifier decided" is not an answer.** A FinOps buyer will ask why a given call got the cheap model. Emit every routing decision as a telemetry event carrying its reason. Inspectable routing is the feature; opaque routing is a liability.

**A consolidation worth noticing:** instruction overrides (§8.5), model routing, and — later — dispatch ranking (§8.6) are the same shape: a versioned change, staged rollout, scored against baseline, promoted or rolled back. Build one rollout-and-scoring mechanism with several consumers, not several mechanisms.

This is also the FinOps sale, which north star §8.2 names but only answers with reporting. Cost attribution tells a CIO what they spent. `model: "auto"` reduces it. That belongs in the December proposal as a roadmap item with the measurement story attached.

---

## 10. Risks specific to this plan

- **The ctx refactor slips.** Unglamorous, touches everything, has no demo. If it slips past October it collides with the Werkstudent's first kit and doubles in cost. First commit after PoC, not background work.
- **Two runtimes persist.** If the dispatch core is deferred, MVP ships governance on the Lambda path and the self-hosted path stays open — the inverse of P7, discovered by the customer's security review rather than by us.
- **Ströer timing.** Proposal December, start February means MVP has no slack. The cuts in §5 are how it fits; taking them in January instead of October means taking them under pressure.
- **Founder bandwidth.** One person cannot run the critical path (dispatch, grants, identity) *and* the sales motion in the same quarter. The Werkstudent path — first view → first connector → first kit → first skill — is well chosen because none of it is on the critical path. Keep it that way.
- **Per-kit SQLite at org scale.** If a Beta unit has 200 reps × 4 kits, that is 800 databases. Decide the shared-org-DB path during Beta, not at the Phase 3 boundary. The debrief agent brings this forward: its data model is DynamoDB, so the storage-adapter question has to be answered in MVP either way.
- **The debrief agent gets built beside the SDK, not through it** (§8.2). The most likely failure mode of this entire plan, because it is the *fast* path and produces a working demo. Fressnapf already went this way once. Mitigation: every M2/M3 component ships as an SDK primitive with the agent as its first caller, and no debrief PR lands with a private reimplementation of jobs, sessions, or storage.
- **Voice latency is unachievable** at the specced budget with the chosen pipeline. Owned by M1, which is why M1 runs first. If p95 lands above ~2.5 s, the product framing changes (asynchronous voice note instead of a live call) and §5's channel work re-scopes.
- **The pilot has a legal path, not just a technical one.** Volunteer consent, deletion on request, and the §87 BetrVG posture in `debrief-agent-spec.md` §15 are M4 blockers with a lead time that is not engineering time. Start them in October. The metadata-only telemetry decision (§8.7) is what makes the conversation short; if bodies are ever logged "just for debugging", it becomes long.
- **`defineAgent` becomes a framework.** Once a loop primitive exists, "can it call another kit / branch / retry / fan out" arrives within a month, and the answer has to be no. Write the one-kit-one-trigger boundary into the north star *in the same edit* that adds the primitive.
- **`model: "auto"` gets promised before it can be delivered.** The most quotable item here and the furthest from shipping. Say "declarative routing today, learned routing once your data supports it" in every external conversation.
- **The pilot depends on a chat surface** the org may not have. Debrief v0.3 §3 makes it a hard dependency and OQ 2a leaves the surface undecided. Whichever it is, it needs the router's OAuth server working and a volunteer onboarding path. That is MVP step 6 work with an M4 deadline; do not let it sit behind Entra federation, which is a separate problem.
- **Passthrough invites "just host my server".** (New.) Once any MCP server can be registered, the first thing asked for is a hosted multi-tenant tier. In a customer's VPC it's their code on their infra; hosted, it's untrusted code and needs real isolation. Don't offer hosted before Production, and don't let the in-VPC story be delayed by it.
- **Five buyers, no door.** (New.) The same data plane serves employees (discovery), devs (experimentation), FinOps (cost), platform owners (deployments) and executives (decisions written down). Pitching all five to one account sells to none. Pick the door per account; show the full picture once.

---

## 11. Open decisions

Ordered by when they must be answered.

1. **PoC gate date** — Fressnapf-only on the 7th and debrief M1 by the 15th, or both to the 15th? **Due now (14 Sept).** Whatever the answer, write down the three numbers from §4.
2. **Storefront adapter placement** — kit-local module or the first `rest` connector? Recommend kit-local now, ported in MVP step 8 as the interface's second instance. *(this week)*
2a. **Fressnapf checkout** — Stripe sandbox embedded in the view, or hosted page + polling? Decided by the sandbox spike, not by preference. *(this week)*
3. **Does the debrief agent run on KitStack or beside it for M1–M2?** Beside it is faster and probably right through M1; the commitment that matters is that M3 lands *as SDK primitives*. Decide explicitly rather than by drift — §8.2. *(this month)*
3a. **Amend the north star's "no agent framework" non-goal** with the one-kit-one-trigger boundary from §9.2, in the same edit that introduces `defineAgent`. *(this month)*
3b. **Minimal platform version for the pilot** (`debrief-agent-spec.md` OQ7). Baseline instruction serving covers M1–M4; overrides and scoring land with the flywheel. Confirm so M3 doesn't quietly grow the override store. *(this month)*
3c. **Does the debrief voice loop run on `defineAgent` v1, or stay specialized?** Recommend specialized through M2 and converge after (§9.3). *(October)*
3d. **Which LLM provider abstraction does `defineAgent` take?** A connector (P4-consistent; the north star already says "pinned model providers per org"), or a first-class field. Recommend connector — it inherits secrets-at-bind-time and per-org pinning for free. *(before MVP step 8)*
4. **`ctx` shim lifetime** — one minor version, or hard break at 0.2.0 while there are six kits and no external users? A hard break is cheaper now and impossible later. *(before MVP step 2)*
5. **Storage adapter shape** — does `ctx.db` become pluggable (libSQL | Dynamo | postgres), or does the debrief kit keep a private store behind a connector? The first is the P4-consistent answer and the harder one. *(October, blocks debrief M2)*
6. **Media session runtime** — Fargate task vs. long-running Lambda (`debrief-agent-spec.md` OQ5). With a container build both are deploy targets; `serve({ mode: "daemon" })` has to express it either way. *(M1)*
7. **Calendar provider** — Google vs. MS Graph, from what Ströer volunteers actually use. *(rep workshop)*
8. **Shell hosting** — served by the router process or a separate static deploy? Answer with the view host contract in MVP step 3, not in Beta. *(October)*
9. **Proxy in KitStack or a separate product** — after two enterprise conversations. §8.7 narrows the shape (reverse proxy over LiteLLM) but not the packaging. *(Q1 2027)*
10. **Manifest format** (§8.6) — what a bring-your-own server declares, and whether SDK-built kits emit it automatically. Decide before any external server is registered; changing it later means migrating every registered server. *(Beta, January)*
11. **Memory kit exposure** (§8.8) — internal dogfood only, or offered to customers in Beta? Decide after the cross-repo test has run for a month, not before. *(Beta, ~March)*

---

## 12. What changed in this revision

No change to stage gates, spine, ordering, or the debrief agent as forcing function. Changes are explanatory or fold in decisions made 5–14 September that refine the plan:

- §0 added: how to read, and the three load-bearing terms.
- §2: rationale for the ordering written out; "why dispatch is also the security story".
- §4: Fressnapf gains a Stripe-sandbox checkout view; PoC gate marked as due.
- §5 step 4: passthrough via manifest is a shape decision inside the dispatch core (§8.6).
- §5 step 9: telemetry is metadata-only by design; per-tool struggle metrics added; both are schema decisions, not new work.
- §5 step 11: the build artifact is a container; kit authors never write a Dockerfile.
- §5 cuts: memory kit explicitly deferred to Beta.
- §6: dispatch ranking, URL-per-app, stdio wrapper, memory kit v0 as dogfood.
- §7: proxy shape fixed as reverse proxy over LiteLLM; priority scheduling as a customer-triggered feature, not a pitch.
- §8.5: how instruction scoring should work (alignment speed, held-out comparison) and the layered/locked model.
- §8.6–§8.8 new: passthrough and why dispatch stays; proxy and the no-transcripts decision; the memory kit.
- §9.2: kit-to-kit calls named as a dependency, not orchestration, so they stay inside the boundary.
- §10: two risks added (hosted multi-tenant pull; five buyers, no door).
- §11: decisions 2a, 10, 11 added; decision 1 marked due.