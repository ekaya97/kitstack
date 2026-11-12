---
id: T-0157
title: "Expose memory approval and publication in demo flow"
status: done
priority: critical
created: "2026-09-15T10:19:19Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - sales-voice
  - memory
  - dogfood
branch: null
files: []
depends_on: []
---

## Description

Make candidate memory approve/publish callable from the demo MCP/UI flow so the documented correction -> candidate -> approved -> published -> next-run retrieval loop is executable without private service calls. Preserve org/kit isolation and metadata-only storage.

## Work Log
### [2026-09-15T10:22:58Z] project-manager
Implemented canonical approveMemory/publishMemory operations with public input types, session membership guard, typed MemoryContext propagation, compatibility wrappers, and focused isolation/metadata tests. Commit 77b28a1; 5/5 focused tests pass. Package tsc remains blocked by pre-existing errors in src/dogfood.e2e.test.ts.