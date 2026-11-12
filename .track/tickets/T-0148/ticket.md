---
id: T-0148
title: "Implement file-backed instruction plugin"
status: done
priority: high
created: "2026-09-14T20:53:32Z"
created_by: human
claimed_by: agent-sartre
claimed_at: "2026-09-14T21:10:18Z"
labels:
  - sales-voice
  - instructions
  - dogfood
branch: demo-sales-voice-agent
files: []
depends_on: []
---

## Description

M-02. Depends on O-01 and P-03. Use kits/debrief/SKILL.md plus instruction files as the single baseline source. Pick kits/debrief as the kit name. Resolve content with id and version/hash and log every served instruction. For this window omit locked status unless implemented as true when the file hash matches a pinned manifest hash; do not return an unexplained field. Add resolution/version/telemetry tests.

## Work Log
### [2026-09-14T21:10:18Z] project-manager
Launched Sartre on disjoint packages/demo/src/instructions scope; file-backed baseline, stable version/hash, no live rollout or misleading locked state.
### [2026-09-14T21:14:11Z] project-manager
Completed and committed as ab7c357. Added packages/demo/src/instructions/index.ts plus debrief-baseline.md and focused tests. Supports default file-backed and injected manifests, hash-derived stable versions, deterministic kit/context/locale resolution, future DemoPlugin-compatible invoke/resolve context with org/app/session/trace/parent identity, metadata-only instruction.served telemetry with instructionVersions, and no locked/rollout/body retention. Scoped tsc passed; package demo Vitest passed 8 files / 45 tests; package-wide tsc still reports only unrelated pre-existing memory errors.
