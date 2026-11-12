---
id: T-0153
title: "Compose demo runtime and mount end-to-end routes"
status: done
priority: critical
created: "2026-09-14T21:42:48Z"
created_by: project-manager
claimed_by: agent-ramanujan
claimed_at: "2026-09-14T21:49:32Z"
labels:
  - sales-voice
  - demo
  - integration
  - mcp
branch: demo-sales-voice-agent
files: []
depends_on:
  - T-0144
  - T-0145
  - T-0146
  - T-0147
  - T-0148
  - T-0149
  - T-0150
  - T-0151
---

## Description

Integrate the completed demo slices into one runnable local composition. Own packages/demo/src/app/ and packages/demo/src/http/ plus focused integration tests. Instantiate one dedicated libSQL client/database and share telemetry, app registry, memory, instructions, DebriefService, VoiceSimulator/provider, proxy, plugin registry. Mount POST /mcp with SDK auth-none and exactly the five debrief tools; POST /t/voice/start, POST /t/voice/status; POST /v1/apps/register, POST /v1/apps/:id/token; POST /v1/chat/completions through the tokenized proxy; GET /api/demo/observability; GET /api/demo/sessions/:id; POST /api/demo/reset. Preserve app registrations/tokens on reset while clearing sessions/memory/telemetry. Keep Claude OAuth isolated/optional and document public-tunnel auth-none caveat. Text extraction/read-back must use injected proxy app identity; simulator is default. Add a real two-run dogfood integration test: prebrief -> voice -> partial/teach -> approve/publish -> run-2 memory retrieval -> confirmation, asserting one session ID, telemetry/cost/app identity/instruction/memory references, and reset repeatability. No transcript/audio/tool payload persistence. Do not import packages/mcp-server internals.

## Work Log
### [2026-09-14T21:43:14Z] project-manager
Launched Ampere for composition/integration. One shared client/runtime, complete route surface, actual two-run dogfood test, no internal mcp-server imports.
### [2026-09-14T21:46:32Z] project-manager
Ampere stalled; split T-0153A to Carver for app composition plus actual two-run dogfood under packages/demo/src/app only. HTTP mounting deferred to T-0153B.
### [2026-09-14T21:48:05Z] project-manager
T-0153A completed as commit 7079d7b: added only packages/demo/src/app/index.ts and index.test.ts. Composes real telemetry, AppRegistry, MemoryStore, baseline InstructionPlugin, DebriefService, VoiceSimulator, and plugin registry; two-run dogfood plus reset-preservation test passes. Scoped tsc/Vitest pass.
### [2026-09-14T21:49:32Z] project-manager
Carver composition 66de968 reviewed green (61 tests). Launched Ramanujan for route/MCP integration only; real route-level dogfood, five-tool Claude discovery, proxy app token, reset preservation.
### [2026-09-14T21:59:13Z] project-manager
PM integrated route composition 2bcd6a9 and tightened both-run route dogfood in fdedf16. Independent package tsc passed; demo suite 63/63 passed. MCP tools/list exposes five debrief tools; app/token/proxy/voice/observability/reset routes verified; reset preserves app token.
