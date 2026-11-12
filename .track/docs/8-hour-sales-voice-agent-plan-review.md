# Review: 8-Hour Sales Voice Agent Execution Plan

**Reviewing:** `.track/docs/8-hour-sales-voice-agent-execution-plan.md` (14 Sep 2026)
**Reader:** the planning agent that authored it
**Out of scope for this review:** the eight-hour timing table. Not assessed by instruction.
**Purpose:** deliver a list of verified facts, defects, and required edits that can be applied to the plan mechanically.

Each item is tagged:
- `VERIFIED` — checked against the repository on 14 Sep 2026.
- `DEFECT` — the plan is wrong, under-specified, or self-contradictory.
- `EDIT` — a concrete change to make to the plan text.
- `DECISION` — a choice the plan must record before execution starts.

---

## 1. Repository claims — verification results

All claims in "Repository reality" were checked. Result: **all hold.** Details that sharpen them:

| Plan claim | Status | Precision added |
|---|---|---|
| `packages/mcp-server/src/framework` duplicates SDK runtime | VERIFIED | 849 LOC. Files: `app-token.ts`, `db-provisioner.ts`, `define-kit.ts`, `define-tool.ts`, `dynamo.ts`, `index.ts`, `kit-db.ts`, `kit-runtime.ts`, `types.ts`. |
| `packages/mcp-server/src/kits` duplicates kits | VERIFIED | 2,971 LOC. Consumed only by `packages/mcp-server/src/scripts/seed-registry.ts` (imports `kits/meeting`, `kits/crm`, `kits/expense`, `kits/outreach`) and by package.json `exports` for the four `./kits/*/migrations` subpaths. |
| `serve()` does not provide `checkAuthz` | VERIFIED | `checkAuthz` appears in `packages/sdk/src/runtime/mcp-handler.ts:53`, `packages/sdk/src/server/adapters/local.ts:23`, `packages/sdk/src/testing/index.ts:218`. `serve()` is at `packages/sdk/src/server/index.ts:109` and does not thread it. |
| No root `CLAUDE.md` | VERIFIED | Absent. |
| `npm run test:run` fails, deps not installed | VERIFIED | No root `node_modules`. Root `dependencies` is empty; workspaces are `web`, `packages/sdk`, `packages/mcp-server`, `packages/authz`. |
| `deprecated/` is ignored | VERIFIED | `.gitignore:67`. 6,113 LOC. Also `.track/` is ignored at `.gitignore:59`. |
| `kits/adint`, `kits/fressnapf` untracked | VERIFIED | `git status` shows both as `??`. |
| OAuth client registration, app JWT signing exist | VERIFIED | `packages/mcp-server/src/router/oauth/{authorize,helpers,metadata,register,token}.ts`; `packages/mcp-server/src/router/app-token.ts`; a second copy at `packages/mcp-server/src/framework/app-token.ts`. |
| Roadmap §5 step 1 and §9.3 exist and say what the plan says | VERIFIED | `.track/specs/kitstack-implementation-roadmap.md:149` (step 1: delete `mcp-server/src/kits`, `mcp-server/src/framework`, `deprecated/`; repoint `seed-registry.ts`), `:440` (§9.3 staging table), `:504` (open decision 3c recommends specialized voice loop through M2). |

Additional verified facts the plan does not mention:

- **Web imports from framework** (live, excluding `.next/` build output): `web/src/services/turso-provisioner.ts` (`framework/dynamo`), `web/src/services/mcp-sync.service.ts` (`framework/dynamo`, `framework/types`), `web/src/app/api/activate-kit/__tests__/route.test.ts` (`framework/dynamo`, `framework/db-provisioner`). These resolve through `packages/mcp-server/package.json` `exports`: `./framework/dynamo`, `./framework/types`. `./framework/db-provisioner` is **not** in `exports`, so that test import is already broken or relies on a path alias.
- **`app-token.ts` claim shape** (`packages/mcp-server/src/router/app-token.ts`): `sub` (userId) and `kit`. No `app_id`, no `scopes`, no `aud`. O-02's "adding `app_id` and scopes" is therefore a new claim set, not an extension.
- **SDK dependencies** are only `esbuild`, `picocolors`, `tsx`. The SDK has no SQLite/libSQL dependency. `@libsql/client` is a dependency of `packages/mcp-server` and `web`, not `packages/sdk`. M-01 ("SQLite-backed store") and the telemetry store need a home with that dependency.
- **SDK auth adapters** exist at `packages/sdk/src/server/auth/{adapter,kitstack,none,oauth}.ts`. The local runtime in C-02 can reuse `none.ts` or `oauth.ts` rather than the router OAuth code.
- **Both claude.ai kitstack MCP connectors returned HTTP 502** at the time of this review. Acceptance criterion 1 depends on a working remote MCP path; see §3.4.

---

## 2. Structural defects

### 2.1 C-01 has no dependency edge into the acceptance criteria — `DEFECT`

C-02 states the demo runtime must not depend on SST, Lambda, Turso, or Entra. Every C-01 sub-step (relocating Dynamo helpers, db-provisioner, libSQL client, updating web imports, router tests, deployment scripts, repointing registry/build code) touches only those paths. No acceptance criterion (1–9) reads anything C-01 produces.

Consequences:
- C-01 is the only ticket that modifies the 20,010-LOC `web/src` tree and the router test suite, and it is the only ticket that can break `tsc` for reasons unrelated to the demo.
- C-01 step 7 ("repoint registry/build code at SDK-based kits") has no consumer inside the demo.

`EDIT` — Split C-01:
- **C-01a (keep, in scope):** `rm -rf deprecated/` after `rg` confirms zero live imports. Ignored tree, zero consumers found.
- **C-01b (move to "Explicit cuts"):** everything else in C-01. Add the line: "Duplicate framework/kits removal is roadmap §5 step 1 and is not a demo dependency. The demo package imports only from `packages/sdk`."

`EDIT` — Add to C-02: "New demo code lives in a new workspace package (e.g. `packages/demo`) whose only internal dependency is `@kitstackco/sdk`. It must not import from `packages/mcp-server/src/framework`, `router`, or `kits`. Copy, do not import, anything needed from `router/app-token.ts` or `router/oauth/*`."

### 2.2 "Subject to compile checks" has no defined check — `DEFECT`

The plan gates C-01 on compile checks and states the test runner cannot start. No ticket installs dependencies, records a baseline, or names the command.

`EDIT` — Add ticket **C-00 — baseline**, before V-03:
1. `npm install` at root.
2. Record `npx tsc --noEmit -p tsconfig.json` exit code and error count.
3. Record `npm run test:run` pass/fail counts.
4. `git checkout -b <demo-branch>`; `git add kits/adint kits/fressnapf && git commit` so the untracked kits are recoverable before any deletion step runs.
5. Definition: "compile check" = `tsc` error count does not increase from baseline; "test check" = failing test count does not increase from baseline.

### 2.3 Every workstream writes to the telemetry store, but O-01 is sequenced after P-01–P-03 — `DEFECT`

M-01 ("every read and write emits telemetry"), M-02 ("log the ID and version on every session"), S-02, V-02, O-02, O-03, and UI-01–03 all depend on the O-01 record shape. P-01–P-03 also emit (`plugin.registered`, telemetry/audit step in dispatch). UI-03 is named "the primary proof."

`EDIT` — Reorder: O-01 before P-01. State it explicitly: "O-01 is the first code written. Its record type is frozen before any emitter exists."

`EDIT` — O-01 record: add `parentId?: string` (or `traceId`) so UI-03 can render a tree rather than a flat timeline, and `appId` must be nullable for events emitted before token issuance (plugin registration, instruction load at boot).

### 2.4 O-03 proxy has no stated caller — `DEFECT`, `DECISION`

Acceptance criterion 7 requires "cost, latency" in the developer UI. The plan does not say whether the voice loop's LLM calls go through `POST /v1/chat/completions` or call the upstream directly.

- If **through the proxy**: the proxy is load-bearing for criteria 4 and 7 and must be built before S-03. Also, a voice loop using a realtime/audio model cannot use a chat-completions-shaped proxy; only the extraction/read-back text calls can.
- If **direct**: no acceptance criterion exercises the proxy. It is then the cheapest cut in the plan.

`DECISION` — Record one of:
- (a) "Text inference (extraction, read-back generation) routes through the proxy with the app token. Realtime audio calls emit inference telemetry directly via O-01. The proxy is load-bearing." Move O-03 before S-03.
- (b) "The proxy is not on the demo path." Move O-03 to "Explicit cuts" and delete `/v1/chat/completions` from C-02.

### 2.5 Acceptance criterion 1 (Claude.ai connects) has no supporting ticket — `DEFECT`

C-02 exposes `POST /mcp` only. Claude.ai remote MCP requires a public HTTPS URL and either no-auth or OAuth discovery (`/.well-known/oauth-authorization-server`, `/authorize`, `/token`, dynamic `/register`). V-03 smokes the voice tunnel, not the MCP tunnel. O-02 says "keep OAuth client registration for Claude MCP connectivity separate" but no ticket implements it in the local runtime.

`EDIT` — Extend V-03 to "**V-03 — external smoke gate**": add "(d) Claude.ai custom connector reaches the tunnel URL's `/mcp` and lists tools." Add to C-02 either the auth-none path (`packages/sdk/src/server/auth/none.ts`) with a stated security caveat for the demo, or the four OAuth endpoints copied from `router/oauth/*`.

`DECISION` — auth-none vs OAuth for the demo MCP endpoint.

### 2.6 Two-run acceptance has no reset mechanism — `DEFECT`

Criteria 8–9 require run 2 to retrieve memory written in run 1. The rehearsal line says "reset instructions" but C-02 exposes no reset endpoint and no ticket writes one. Without reset, run 2 of a rehearsal contaminates the live demo's run 1.

`EDIT` — Add `POST /api/demo/reset` to C-02, scoped to: clear `memory_*` tables, sessions, telemetry; preserve app registrations and tokens. Add to S-01 tools or M-01: `memory.reset` (demo-only, guarded by env flag).

---

## 3. Under-specifications that will block execution

### 3.1 Kit name — `DECISION`
S-01 says "`kits/debrief` or `kits/sales`". M-02 already hardcodes `kits/debrief/SKILL.md`. Pick `kits/debrief`; delete the alternative from S-01.

### 3.2 Providers unnamed — `DECISION`
Never stated: (a) realtime voice provider and model, (b) STT/TTS provider if not realtime, (c) proxy upstream provider and model, (d) model used for extraction/read-back. O-03 step 6 ("small pricing table") and O-01 `model` field cannot be written without these. Record all four as named strings in "Decisions recorded".

### 3.3 Storage home for memory and telemetry — `DECISION`
M-01 says SQLite; the SDK has no SQLite dependency. Options: add `@libsql/client` (already in the monorepo lockfile via mcp-server/web) or `better-sqlite3` to the new demo package. Do not add it to `packages/sdk`. Record the choice and confirm `databases/local.db` (referenced by `npm run dev:db`) is not reused.

### 3.4 P-02 context shape contains unused fields — `EDIT`
`connectors` has no demo consumer ("CRM/calendar/SMS integrations remain future connectors"). Remove from the demo contract or mark `connectors: never` for the window. Otherwise the new kit's type will drift from the roadmap §5 step 2 shape (`{ db, connectors, identity, channel, telemetry, audit, log }`) in a way that is neither superset nor subset.

### 3.5 P-01 plugin kinds exceed demo usage — `EDIT`
Six kinds are listed. The demo registers: `kit` (debrief), `memory`, `instructions`, `proxy` (if 2.4a), `trigger` (voice start? unclear). `connector` has no instance. Either list the concrete plugin instance per kind in P-01, or drop kinds with zero instances. An enum with unregistered members is a design commitment made without a test.

### 3.6 S-02 state machine has an unreachable transition — `EDIT`
```
prepared → calling → awaiting_confirmation → confirmed
                                      ↘ partial
```
`partial` has no exit and no producer named. State which tool emits `partial` (presumably `confirm_debrief` with corrections) and whether `partial → confirmed` is allowed after `teach_from_correction`. Also add `failed` (voice start error, provider timeout) or the trace in UI-03 cannot render a bad run.

### 3.7 "Do not retain audio or transcripts" is under-specified at the provider — `EDIT`
V-02's non-retention applies to the local runtime. Twilio records calls only when told to, but realtime voice providers may retain by default. Add to V-01: "Set provider-side retention/recording off explicitly; log the setting as a telemetry event at call start." Add to M-01: `memory_feedback.correction` is free text entered by the operator, not transcript; state that.

### 3.8 O-02 reuse claim is inaccurate — `EDIT`
"Reuse the existing JWT approach from `router/app-token.ts`, adding `app_id` and scopes." Verified claim set is `{ sub, kit }`. Rewrite as: "Copy the `jose` sign/verify pattern from `router/app-token.ts`; define a new claim set `{ sub: appId, org, scopes[], exp }`. Do not import the existing function."

### 3.9 Instruction "locked status" has no producer — `EDIT`
M-02 returns `locked`. Nothing in the plan sets it. Either define it (e.g. `locked = true` when the file hash matches a pinned hash in kit manifest) or remove the field for the window.

---

## 4. Items that are correct and should not be changed

- "Repository reality" section: accurate; keep as-is.
- Decision 7 (feedback → candidate memory → next-run retrieval, explicitly not RL): correct framing, matches roadmap §8.8 and the "not model-weight training" disclaimer.
- Decision 5 (metadata-only, no transcript storage): matches roadmap §5 step 9 and §8.7.
- Decision 4 (specialized voice loop, no `defineAgent` prerequisite): matches roadmap open decision 3c.
- "Explicit cuts" list: complete and consistent with the acceptance criteria, with the exceptions noted in 2.1 and 2.4.
- V-01 simulator as first-class fallback with honest labeling: correct; keep the simulator as the default path and Twilio as the upgrade, not the reverse.
- Acceptance criteria 1–9: concrete and testable. Keep. Add criterion 10: "Reset restores the pre-run-1 state; run 1 can be repeated."

---

## 5. Consolidated edit list

Apply in order:

1. Insert **C-00 baseline** (install, `tsc`/`vitest` baseline, branch, commit untracked kits).
2. Split **C-01** into C-01a (delete `deprecated/`) and C-01b (moved to Explicit cuts).
3. Amend **C-02**: new package importing only `@kitstackco/sdk`; add `POST /api/demo/reset`; add MCP auth endpoints or auth-none per decision 2.5; remove `/v1/chat/completions` if decision 2.4b.
4. Move **O-01** to first position; add `parentId`/`traceId`; make `appId` nullable.
5. Rewrite **O-02** reuse language per 3.8.
6. Resolve **O-03** caller per 2.4; move before S-03 or to cuts.
7. Extend **V-03** with the Claude.ai MCP tunnel smoke.
8. Fix **S-01** kit name → `kits/debrief`.
9. Fix **S-02** state machine: `partial` exit, `failed` state.
10. Trim **P-01** kinds and **P-02** fields to instances that exist in the demo.
11. Define or remove **M-02** `locked`.
12. Add provider retention setting to **V-01**.
13. Add to "Decisions recorded": kit name, four provider/model names, storage library, MCP auth mode, proxy on/off path.
14. Add acceptance criterion 10 (reset).

---

## 6. Facts the executing agent will need that the plan omits

- Root `package.json` has no `build` or `typecheck` script; `tsc` must be invoked directly.
- `packages/mcp-server/package.json` `exports` is a hardcoded map; any relocation under C-01b requires editing it, and `./framework/db-provisioner` is already missing from it.
- `web/.next/` contains stale generated type files that import from `kits/` paths; exclude `.next/` from any `rg`-based reference enumeration or the count will be inflated by 8.
- `kits/` has its own `package.json`, `package-lock.json`, and `node_modules`; kit workspaces resolve separately from the root workspaces.
- `.track/` is gitignored; this review and the plan are not versioned unless the ignore is changed.
