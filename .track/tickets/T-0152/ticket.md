---
id: T-0152
title: "Build developer apps, usage, and session-trace UI"
status: done
priority: high
created: "2026-09-14T20:53:44Z"
created_by: human
claimed_by: agent-nash
claimed_at: "2026-09-14T21:59:40Z"
labels:
  - sales-voice
  - ui
  - observability
branch: demo-sales-voice-agent
files: []
depends_on: []
---

## Description

UI-01/UI-02/UI-03. Depends on O-01 and C-02. Add the smallest developer-facing UI, reusing existing dashboard styling only where useful. Apps screen: registration, scopes, token issuance, expiry, masked token, events. Usage screen: cost, tokens, latency p50/p95, outcomes, channel/plugin/kit breakdown, memory and instruction events, app filter. Session trace must render parentId/traceId as a tree. Add a reset control that preserves app registrations and tokens.

## Work Log
### [2026-09-14T21:59:40Z] project-manager
Launched Nash on thin web /demo observability proof surface only; Apps, Usage, Session Trace, reset, no backend overlap or token persistence.
### [2026-09-14T22:04:15Z] project-manager
Implemented and committed 94064f1. Added web/src/app/demo/page.tsx and page.test.tsx only: Apps registration/token reveal/expiry/scopes/event counts, Usage metrics and app/channel/plugin/kit filters with memory/instruction refs, Session Trace timeline with parentId/traceId, reset, configurable API URL, loading/error/empty states, and auth-none/public-tunnel caveat. Focused jsdom tests pass 2/2; diff check clean. Unrelated concurrent package/demo backend modifications remain uncommitted.
### [2026-09-14T22:06:07Z] project-manager
PM review: UI commit 94064f1 plus test fix 55d4c59. Focused web page test passed 2/2. Full web tsc is blocked by pre-existing .next/SST/resource/export errors; no new demo-page error identified. UI has Apps/Usage/Session Trace/reset, token masking, filters, caveat.
