---
id: T-0151
title: "Implement voice provider adapter and external smoke gate"
status: done
priority: critical
created: "2026-09-14T20:53:42Z"
created_by: human
claimed_by: agent-mill
claimed_at: "2026-09-14T21:39:22Z"
labels:
  - sales-voice
  - voice
  - external
branch: demo-sales-voice-agent
files: []
depends_on: []
---

## Description

V-01/V-02/V-03. Depends on C-02 and S-01. Make the scripted simulator the default deterministic path and add a Twilio/realtime upgrade adapter. Set provider-side recording/retention off explicitly and emit a call-start telemetry event recording that setting. Implement voice start/status/media boundaries and German interview turns. External smoke must test public HTTPS/WSS reachability and Claude.ai custom-connector access to /mcp; document auth-none caveat or OAuth endpoints. Live path is not green unless provider credentials and tunnel work.

## Work Log
### [2026-09-14T21:30:13Z] project-manager
Launched Galileo on disjoint packages/demo/src/voice scope; simulator default, provider retention off, German turns, external smoke helper; no route overlap.
### [2026-09-14T21:34:54Z] project-manager
Previous voice worker stalled; split T-0151A to Nietzsche for simulator-only implementation under packages/demo/src/voice, no provider or route overlap.
### [2026-09-14T21:39:01Z] project-manager
Simulator slice committed 43a2122 plus corrective f2f6d3f; PM rerun passed 54/54 demo tests and TypeScript. Shared debrief partial/failed state is now authoritative. Provider adapter and external Claude/tunnel smoke remain open.
### [2026-09-14T21:39:22Z] project-manager
Launched Mill on T-0151B provider config/external smoke only under packages/demo/src/voice/provider.ts; simulator files frozen.
### [2026-09-14T21:41:43Z] project-manager
T-0151B committed as 5ff97ab. Added provider.ts and provider.test.ts only: simulator default, explicit Twilio/OpenAI realtime config boundary, recording=false/retention=false metadata-only start event, status/media types, injected HTTPS/WSS + Claude MCP smoke gate with blocked/failed outcomes. Demo tsc passed; 60/60 Vitest tests passed; git diff --check passed; worktree clean.
### [2026-09-14T21:42:06Z] project-manager
PM review passed commits 43a2122/f2f6d3f/5ff97ab; package TypeScript passed and demo suite 60/60 passed. External smoke is correctly blocked without URLs/fetch; live path remains credential/tunnel dependent.
