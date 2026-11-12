---
id: T-0154
title: "Add runnable local demo HTTP server entrypoint"
status: done
priority: critical
created: "2026-09-14T22:00:00Z"
created_by: project-manager
claimed_by: agent-godel
claimed_at: "2026-09-14T22:00:16Z"
labels:
  - sales-voice
  - demo
  - server
  - mcp
branch: demo-sales-voice-agent
files: []
depends_on:
  - T-0153
---

## Description

Add packages/demo/src/server.ts and focused tests as a thin Node HTTP adapter over handleDemoAppRequest. Parse JSON bodies, query params, and headers; listen on PORT or 3001; add JSON content type and permissive demo CORS/OPTIONS handling for a public tunnel; expose graceful close; create the DemoApp once and close it on shutdown. Do not add framework dependencies, do not alter mcp-server internals, and do not retain request bodies. Add an npm script only if needed after implementation. Verify a real local request to /mcp tools/list and /api/demo/observability. Document auth-none/public-tunnel caveat and simulator default.

## Work Log
### [2026-09-14T22:00:17Z] project-manager
Launched Godel on packages/demo/src/server.ts and server test only; thin Node HTTP adapter, CORS/OPTIONS, port 3001, graceful lifecycle.
### [2026-09-14T22:02:16Z] project-manager
Implemented and committed as 8ccf48b. Added framework-free Node http.createServer adapter with bounded JSON parsing, URL/query/header normalization, JSON responses, OPTIONS CORS, default PORT/3001 selection, graceful close, owned DemoApp lifecycle, and auth-none/public-tunnel caveat. Server tests exercise real /mcp tools/list and /api/demo/observability requests plus CORS, body limit, and idempotent close. Package tsc passed; full demo Vitest passed 66 tests (loopback run required elevated sandbox access).
### [2026-09-14T22:04:29Z] project-manager
PM verified commit 8ccf48b plus launch hook b024410. Demo tsc passed; elevated real-TCP server tests 3/3 passed; npm run demo:server started on 127.0.0.1:3001; real curl /mcp tools/list returned five tools and observability returned events/aggregate.
