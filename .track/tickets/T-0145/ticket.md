---
id: T-0145
title: "Implement demo plugin registry and dispatch context"
status: done
priority: critical
created: "2026-09-14T20:53:22Z"
created_by: human
claimed_by: agent-einstein
claimed_at: "2026-09-14T21:01:17Z"
labels:
  - sales-voice
  - plugins
  - foundation
branch: demo-sales-voice-agent
files: []
depends_on: []
---

## Description

P-01/P-02/P-03. Depends on O-01. Add a minimal registry and concrete demo plugin instances: debrief kit, memory, instructions, voice HTTP trigger, and proxy. Do not register unused connector kinds. Add a compatibility context for new code with db, identity, channel, session, telemetry, audit, log, memory, and instructions; connectors is omitted for this demo window. Implement unified dispatch resolve -> identity -> demo grant -> context -> invoke -> telemetry/audit. New demo code may import only @kitstackco/sdk and the demo telemetry/runtime package, never mcp-server/src/framework, router, or kits.

## Work Log
### [2026-09-14T21:01:18Z] project-manager
Launched Einstein on disjoint packages/demo/src/plugins scope; no connector registration; focused tests required.
### [2026-09-14T21:04:17Z] project-manager
Implemented and committed as af84e23. Added typed PluginRegistry, stable DemoPluginContext with org/app/session/trace/parent/telemetry/lookup, duplicate/unknown errors, deterministic five-plugin bootstrap with no connectors, and plugin.registered telemetry. Verification: ../../node_modules/.bin/tsc --noEmit -p packages/demo/tsconfig.json; cd packages/demo && ../../node_modules/.bin/vitest run --config vitest.config.ts src/plugins/index.test.ts — 7/7 passed; git diff --check clean.
