---
id: T-0146
title: "Create isolated demo HTTP/MCP runtime"
status: done
priority: critical
created: "2026-09-14T20:53:26Z"
created_by: human
claimed_by: agent-popper
claimed_at: "2026-09-14T21:05:29Z"
labels:
  - sales-voice
  - demo
  - runtime
branch: demo-sales-voice-agent
files: []
depends_on: []
---

## Description

C-02. Depends on O-01 and P-03. Create packages/demo as a new workspace package whose only internal dependency is @kitstackco/sdk plus the selected storage dependency. Expose POST /mcp, POST /t/voice/start, POST /t/voice/status, POST /v1/apps/register, POST /v1/apps/:id/token, POST /v1/chat/completions, GET /api/demo/observability, GET /api/demo/sessions/:id, and POST /api/demo/reset. Implement MCP auth-none for the demo and document the public-tunnel/security caveat. Add the four OAuth discovery/authorize/token endpoints only if needed for Claude.ai connection; keep them isolated from production router code. Reset clears memory, sessions, and telemetry but preserves app registrations/tokens.

## Work Log
### [2026-09-14T21:05:29Z] project-manager
Launched Popper on disjoint packages/demo/src/runtime and src/http skeleton; route-neutral local runtime only, no auth/proxy/voice behavior.
### [2026-09-14T21:09:36Z] project-manager
Completed in commit 7722ce8. Added packages/demo/src/runtime/index.ts and index.test.ts plus packages/demo/src/http/index.ts and index.test.ts. Runtime owns demo TelemetryStore lifecycle, bootstraps the five concrete plugins, creates header-aware stable request context, and guards telemetry-only reset with demo mode + x-demo-reset-token. Framework-neutral handlers/definitions cover POST /mcp (explicit 501 skeleton), POST /api/demo/reset, GET /api/demo/observability, and GET /api/demo/sessions/:id; no voice, memory, auth, proxy, kit behavior, or mcp-server imports. Verification: npm test in packages/demo passes 31 tests across 6 files; npx tsc --noEmit -p packages/demo/tsconfig.json passes; git diff --check passes. Broader app/voice routes from the original ticket description remain deferred to their dependent tickets per this implementation scope.
