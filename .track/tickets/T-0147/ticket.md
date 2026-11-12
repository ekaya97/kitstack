---
id: T-0147
title: "Implement structured memory plugin and replay feedback"
status: done
priority: critical
created: "2026-09-14T20:53:28Z"
created_by: human
claimed_by: agent-herschel
claimed_at: "2026-09-14T21:10:18Z"
labels:
  - sales-voice
  - memory
  - dogfood
branch: demo-sales-voice-agent
files: []
depends_on: []
---

## Description

M-01/M-03. Depends on O-01 and P-03. Implement memory_entries, memory_versions, memory_edges, and memory_feedback in the demo store. Add memory.save, memory.load, memory.feedback, and guarded demo-only memory.reset. Corrections are operator-entered free text, not transcripts. Every operation emits telemetry. After confirmation, a correction creates/updates a candidate structured skill; the next prebrief retrieves it. Add round-trip and reset tests.

## Work Log
### [2026-09-14T21:10:18Z] project-manager
Launched Herschel on disjoint packages/demo/src/memory scope; structured candidate lifecycle, replay retrieval, metadata-only memory telemetry.
### [2026-09-14T21:14:31Z] project-manager
Implemented and committed as 8e38d1b. Added injected @libsql/client structured/versioned memory store under packages/demo/src/memory only: candidate -> approved -> published lifecycle, org/kit/session/context retrieval with stable ordering, scoped reset, replay of approved run-1 feedback in run 2, and metadata-only memory.read/memory.write telemetry carrying app/session/trace/parent IDs and memory IDs. Package-local tsc passed; full demo Vitest passed 45/45 across 8 files; git diff --check passed.
