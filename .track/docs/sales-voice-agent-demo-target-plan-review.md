# Review: Sales Voice Agent Demo — Target Flow and Execution Plan

**Reviewing:** `.track/docs/sales-voice-agent-demo-target-plan.md` (15 Sep 2026)
**Reviewed on:** 15 Sep 2026, branch `demo-sales-voice-agent` at `cf9bee4`
**Purpose:** verify the plan's repository claims, list defects and required edits, record the decisions the plan leaves open, and map the result onto tickets T-0184 to T-0195.

Tags: `VERIFIED` checked against the repository. `DEFECT` the plan is wrong or under-specified. `EDIT` a concrete change applied to the ticket text. `DECISION` a choice recorded so implementation can start.

---

## 1. Verdict

The product definition (§1), the non-goals (§2), and the architectural decision to keep `mcp.kitstack.co` as the presenter origin (§3) are sound and consistent with the code. The ticket split (§4) is the right granularity. The plan has four material gaps that would have surfaced mid-implementation, and the eight-hour timebox (§5) is not credible for the full scope. All four gaps have been folded into the tickets; the timebox is replaced by a two-tier cut line (§6 below).

---

## 2. Repository claims — verification results

Every claim in the plan's "Current status" section was checked. Result: **all hold.** Precision added:

| Plan claim | Status | Precision added |
|---|---|---|
| `prepare_debrief` accepts only `goal` | VERIFIED | Kit schema `kits/debrief/src/tools/index.ts:47`; host schema `packages/demo/src/http/app.ts:14-17`; operations contract `kits/debrief/src/contracts.ts:125`. |
| `DebriefService` keeps sessions in an in-process `Map` | VERIFIED | `packages/demo/src/debrief/index.ts:60`. Restart loss is wider than the plan says: `AppRegistry.apps` (`packages/demo/src/auth/index.ts:36`), `voiceContexts` (`packages/demo/src/server.ts:243`), simulator `calls` (`packages/demo/src/voice/index.ts:19`), and the media-stream `SessionBindingStore` (`packages/demo/src/voice/realtime.ts:488`) are all in-memory. |
| Only memory and telemetry persist | VERIFIED | Two tables: `demo_memories` (`packages/demo/src/memory/index.ts:61`) and `telemetry_events` (`packages/demo/src/telemetry/index.ts:108`). Telemetry already has an additive-column migration pattern (`telemetry/index.ts:159-160`) that T-0186 can reuse. |
| No persisted scheduler | VERIFIED | The only "schedul" hit in `packages/demo`, `kits/debrief`, `packages/sdk` is unrelated (`packages/sdk/src/build.ts`). |
| Live call starts manually | VERIFIED | `POST /t/voice/live/start`, admin token required (`packages/demo/src/http/app.ts:108-113`; `packages/demo/src/server.ts:302`). |
| Live path writes no structured findings | VERIFIED | The `defineAgent` loop's `onStop` only calls `awaitConfirmation` (`packages/demo/src/server.ts:334`); no post-call result write exists. |
| `kits/debrief` has five tools and no Views | VERIFIED | Five tools in `kits/debrief/src/tools/index.ts`. The host `/mcp` exposes nine (adds `approve_memory`, `publish_memory`, `start_voice_call`, `get_voice_status` in `packages/demo/src/http/app.ts:12-58`). The kit config has `schema: {}`, `migrationSql: "SELECT 1;"`, and no `views` (`kits/debrief/kit.config.ts`). |
| `/demo` has Apps, Overview, Plugins, Usage, Session Trace | VERIFIED | `web/src/app/demo/page.tsx:81-87`. |
| `mcp.kitstack.co` router exists with OAuth and is not wired to the debrief runtime | VERIFIED | `packages/mcp-server/src/router/{handler,platform-adapter,tool-dispatcher,kit-handler}.ts`, `infra/mcp.ts:197`. OAuth discovery returned HTTP 200 on 15 Sep (the 14 Sep review saw 502s). |
| Voice service deployed on a dedicated domain | VERIFIED | `infra/demo.ts`: one ECS/Fargate task (`scaling: {min:1,max:1}`), ALB on `KITSTACK_DEMO_VOICE_DOMAIN`, `KITSTACK_DEMO_MCP_AUTH: "app-token"`. |
| SDK supports MCP Views with loaders and `callTool` | VERIFIED | `packages/sdk/src/define-view.ts`, `define-loader.ts`; the View bridge is `useKit()` in `packages/sdk/views/src/shared/use-kit.ts` exposing `reload()` and `callTool(name, params)`. There is no `useTool`; the plan's wording is corrected in T-0191. |
| Demo test baseline | VERIFIED (from T-0183) | 97/97 demo tests, 4/4 kit tests, 12/12 SDK plugin tests; dogfood test `packages/demo/src/dogfood.e2e.test.ts` covers run-1 teach → run-2 retrieval and reset repeatability. Every ticket's gate is "this count does not decrease". |

---

## 3. Material defects

### 3.1 The presenter connector exposes `kit` and `kit_view`, not per-kit tools — DEFECT

The router uses the SDK protocol handler (`packages/mcp-server/src/router/mcp-protocol.ts:14` → `packages/sdk/src/server/protocol.ts:95-189`), which lists exactly two MCP tools: `kit` and `kit_view`. A kit's tools are reached as `kit(id="debrief", cmd="prepare_debrief", params={...})`, and Views are rendered by a separate `kit_view(id="debrief", view="prebrief")` call. Consequences:

- T-0185's acceptance ("discover the debrief tools and call `prepare_debrief`") is reworded to: `kit()` lists `debrief`; `kit("debrief")` lists its actions; `kit("debrief","prepare_debrief",{...})` reaches the voice service.
- T-0190's acceptance ("Claude renders the prebrief View after one tool call") is reworded to: after `prepare_debrief`, one `kit_view("debrief","prebrief")` call renders it. The `prepare_debrief` result must name that call in its text so the model issues it.
- The adapter is not a "tool router". `platformAdapter.resolveUserKits` only returns kits with a per-user Turso DB (`getUserKitDbs`), and `executeTool`/`executeLoader` invoke a Lambda ARN from the registry (`platform-adapter.ts:35-129`). The debrief kit has neither. T-0185 must inject a virtual `ResolvedKit` for `debrief` and short-circuit `executeTool`, `executeLoader`, and `getShellHtml` for that kit id before the Lambda/Turso path runs.

### 3.2 View shell hosting has no ticket — DEFECT

`getShellHtml(kitId)` reads a built app shell from S3 keyed by registry metadata (`platform-adapter.ts:131-135`). The debrief kit has no built View bundle and no registry entry. Without one, `kit_view("debrief", …)` cannot render regardless of T-0190. This is a separate, bounded piece of work (build the bundle with the SDK build, publish the shell, or have the adapter fetch it from the voice service). Added as **T-0195**; T-0190, T-0191, T-0192 depend on it.

### 3.3 Identity mapping between router and voice service is unspecified — DEFECT

The router authenticates an OAuth `userId`. The voice service scopes everything by `orgId` and an app-token `appId`, and currently runs with `KITSTACK_DEMO_MCP_AUTH=app-token`. The plan says "forward authenticated user identity" and "must not trust caller-supplied org/user IDs" but does not say how the two meet. Recorded in T-0185:

- A third MCP auth mode `internal-signed` in `packages/demo/src/auth/mcp.ts`: a short-lived JWT signed with a new shared secret (`KITSTACK_DEMO_INTERNAL_SECRET`, added to `infra/secrets.ts`, `infra/mcp.ts`, `infra/demo.ts`), claims `{ sub: userId, org, kit: "debrief", req, trace, exp }`. Copy the `jose` pattern from `router/app-token.ts`; do not reuse its `{sub, kit}` claim set or the static `mcpInternalApiKey` used by `/connected`.
- `userId → orgId` is a static allowlist in the voice service for the demo (one org); unknown users get a 403 mapped to a useful MCP error.

### 3.4 The timestamp rule is open, and the contract has no date or timezone default — DEFECT / DECISION

The presenter says "Call me back at 22:05" with no date and no zone. Decision recorded in T-0184 (override before T-0184 starts if the presenter wants option B):

- `callback_at` is the time the phone should ring. `scheduled_call_at = callback_at + buffer_minutes`, `buffer_minutes` defaults to 0. Both `prebrief_ends_at` (= `callback_at`) and `scheduled_call_at` are returned so timing is never inferred.
- Time-only input resolves to the next occurrence in `callback_timezone`; the timezone is required (no server-local default); a result in the past or more than 24 h ahead fails validation with an actionable message.

---

## 4. Smaller edits applied to tickets

- **Scheduler and rolling deploys.** `scaling` is 1/1, but an ECS deploy briefly runs two tasks. T-0188's idempotency test must model two pollers, not one restart. Ordering rule: claim with lease → mark `starting` → call Twilio → persist call SID. A job stuck in `starting` past its lease is surfaced as failed for operator action, never auto-retried; "no duplicate calls" wins over "always call".
- **Status callback path.** `POST /t/voice/status` is already the simulator's route (`app.ts:99`). T-0189 uses `POST /t/voice/provider-status` for Twilio status callbacks, with signature validation.
- **Customer scoping in telemetry.** T-0193's "filter by customer" needs `customer_id` on `telemetry_events`; added to T-0186's scope using the existing additive-column pattern.
- **Reset.** `DemoApp.reset()` (`packages/demo/src/app/index.ts:177`) clears memory and telemetry only. T-0186 and T-0188 extend it to the new tables, or the two-run rehearsal contaminates itself.
- **Composition root contention.** `packages/demo/src/server.ts` is touched by T-0186, T-0188, T-0189 and T-0185. These run serially with one implementer each; T-0185 and T-0186 may run in parallel because they live in different packages.
- **Confirmation View API name.** `useKit().callTool` and `reload()`; there is no `useTool`.
- **Draft shape.** `debrief_confirmed` is an immutable event; `demo_debrief_drafts` is the mutable pre-confirmation record. Confirming twice returns the same event id.

---

## 5. Things that are correct and were kept unchanged

- §2 non-goals, §3 architecture and the decision to keep the voice service as scheduler/provider runtime.
- §7 decisions 1–6.
- The critical path order in §5 and the fallback ("keep the direct demo endpoint as a temporary presenter fallback; finish local end-to-end first").
- Write scopes per ticket, with the additions noted above.
- The verification strategy in §6.

---

## 6. Timebox — DEFECT, replaced by a cut line

Eight hours is not credible for eleven serial tickets that include a cross-service router adapter, four new tables, a scheduler, live-call rebinding, three MCP Views plus a shell publish pipeline, a dashboard consolidation and a production rehearsal. The previous slice (T-0142 → T-0183) took roughly two calendar days for comparable scope. Rather than re-estimate, tickets carry a tier:

- **Tier 1 (demo minimum, priority critical):** T-0184, T-0186, T-0187, T-0188, T-0189, T-0191. Result: the exact presenter sequence works end to end through the direct voice-service `/mcp` endpoint, with text responses instead of Views.
- **Tier 2 (presenter polish, priority high):** T-0185, T-0195, T-0190, T-0192, T-0194.
- **Tier 3 (developer proof, priority medium):** T-0193.

Tier 1 must be green before Tier 2 starts; Tier 2 may be cut on the day without losing the proof.

---

## 7. Ticket map

| Ticket | Title | Tier | Depends on |
|---|---|---|---|
| T-0184 | Presenter contract and deterministic clock fixture | 1 | — |
| T-0185 | MCP router sales-debrief adapter with signed internal identity | 2 | T-0184 |
| T-0186 | Customer context, event ledger, and durable sessions | 1 | T-0184 |
| T-0187 | Structured prebrief generation | 1 | T-0186 |
| T-0188 | Persisted scheduled-call plugin | 1 | T-0184, T-0186 |
| T-0189 | Live call binding to scheduled sessions | 1 | T-0188 |
| T-0190 | Prebrief View | 2 | T-0185, T-0187, T-0195 |
| T-0191 | Editable confirmation View and mutation tools | 1 (tools) / 2 (View) | T-0186, T-0190 |
| T-0192 | Customer timeline View | 2 | T-0186, T-0191 |
| T-0193 | Consolidate `/demo` into two presenter-facing screens | 3 | T-0188, T-0189, T-0191 |
| T-0194 | Production demo rehearsal and rollback-safe release | 2 | T-0185–T-0193 |
| T-0195 | Debrief kit View bundle and shell publishing | 2 | T-0184 |

All tickets were created with `track create --no-claim` and are in `backlog`.

---

## 8. Ticket hygiene noted in passing

- T-0176, T-0177, T-0178, T-0181 and T-0183 exist only as hand-written `.md` files without frontmatter, so `track list` prints them as `?`. T-0161–T-0175, T-0179, T-0180 and T-0182 are referenced in docs but have no ticket file. Not blocking; new tickets go through the CLI.
- `.track/` is gitignored (`.gitignore:59`); this review and the plan are not versioned.
