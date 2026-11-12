---
id: T-0149
title: "Implement app registration, tokenized proxy, and inference metering"
status: done
priority: critical
created: "2026-09-14T20:53:35Z"
created_by: human
claimed_by: agent-russell
claimed_at: "2026-09-14T21:03:03Z"
labels:
  - sales-voice
  - proxy
  - observability
branch: demo-sales-voice-agent
files: []
depends_on: []
---

## Description

O-02/O-03. Depends on O-01, P-03, and C-02. Copy the jose sign/verify pattern from packages/mcp-server/src/router/app-token.ts but do not import the existing function. Define claims { sub: appId, org, scopes[], exp }. The proxy is on the demo path: text inference for extraction/read-back routes through POST /v1/chat/completions with the app token; realtime audio calls emit inference telemetry directly. Preserve streaming, never persist bodies, read provider usage or estimate it, and emit cost/latency/appId/parentId metadata. Add auth, scope, stream, usage, and cost tests.

## Work Log
### [2026-09-14T21:03:03Z] project-manager
Launched Russell on disjoint packages/demo/src/auth and src/proxy scope; proxy is load-bearing for text extraction/read-back; no live credentials required.
### [2026-09-14T21:08:49Z] project-manager
Completed and committed as 13d7ff0. Added packages/demo/src/auth/index.ts with isolated app registry, exact {sub, org, scopes[], exp} HS256 tokens, 15-minute default TTL, and bearer parsing; added packages/demo/src/proxy/index.ts with injected OpenAI-compatible upstream, auth/scope checks, identity headers, streaming-safe usage extraction/estimation, gpt-4o-mini/gpt-4o pricing, and metadata-only inference telemetry. Focused tests pass: 4 files/22 tests; package-local tsc passes. No live provider credentials required. Scope remained auth/proxy plus tests; unrelated packages/demo/src/http and src/runtime remain untracked and untouched.
