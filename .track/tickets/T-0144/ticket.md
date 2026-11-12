---
id: T-0144
title: "Freeze demo telemetry contract and SQLite store"
status: done
priority: critical
created: "2026-09-14T20:53:18Z"
created_by: human
claimed_by: agent-bravo
claimed_at: "2026-09-14T20:55:26Z"
labels:
  - sales-voice
  - observability
  - foundation
branch: demo-sales-voice-agent
files:
  - packages/demo/src/telemetry/index.ts
  - packages/demo/src/telemetry/index.test.ts
  - packages/demo/package.json
  - packages/demo/tsconfig.json
  - packages/demo/vitest.config.ts
  - packages/demo/README.md
depends_on: []
---

## Description

O-01, first implementation ticket. Define metadata-only event types and a parentId/traceId field for tree rendering. appId must be nullable for boot events before token issuance. Implement a small persistent store in the new demo package using @libsql/client or another explicitly selected dependency; do not add SQLite dependencies to the SDK and do not reuse databases/local.db. Add tests for append, query, aggregate, reset, nullable appId, and parent-child ordering. No prompts, completions, audio, transcripts, or tool payloads may be stored.

## Work Log
### [2026-09-14T20:55:27Z] agent-implementer
Implementing reviewed O-01 contract and demo SQLite-backed metadata store in packages/demo; selected @libsql/client, no SDK/database reuse.
### [2026-09-14T21:01:34Z] agent-bravo
Implemented commit 0e604d6. Added packages/demo telemetry contract/store using @libsql/client with .kitstack/demo.db default, metadata-only whitelisted persistence, nullable appId, parentId/traceId, sequence ordering, filtered query, aggregate dimensions, reset, and local.db guard. Tests: packages/demo npm test -- --run (7 passed); npx tsc --noEmit -p packages/demo/tsconfig.json (passed); root npm run test:run remains pre-existing no-test-files failure. Dependencies installed successfully with npm install --ignore-scripts.
### [2026-09-14T21:02:21Z] project-manager
PM review passed: commit 0e604d6; demo package tsc passed; 7 focused telemetry tests passed; metadata retention boundary and local.db guard verified.
