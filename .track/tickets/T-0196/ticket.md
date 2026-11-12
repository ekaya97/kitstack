---
id: T-0196
title: "Restore package test baselines and root test gate"
status: done
priority: critical
created: "2026-09-16T16:50:21Z"
created_by: human
claimed_by: agent-bravo
claimed_at: "2026-09-16T17:05:28Z"
labels:
  - beta-plan
  - W0
  - G0
branch: null
files: []
depends_on: []
---

## Description

Plan: .track/docs/kitstack-beta-execution-plan.md §11. Review: .track/docs/kitstack-beta-execution-plan-review.md §3.1.

## Goal
Make the recurring verification gates real. Today root npm test runs only the debrief workspace; packages/sdk, packages/mcp-server, and packages/authz have no test script; SDK (2/16 files), router (6/9 files), and web (10/16 files) fail.

## Scope
- SDK: fix tests/deploy-seed-registry.test.ts fixture schema (missing migration_sql column) and the two mcp-handler assertions, or delete tests for removed behavior with a note.
- Router: make tests importable without SST links (mock sst resources or lazy-resolve links); set MCP_JWT_SECRET in the test env.
- Web: fix or delete tests importing @/test/db-helpers, @/lib/authz, @/db/schema, @/app/page.
- Add test scripts to sdk, mcp-server, authz; make root npm test run every workspace; record counts in the work log.

## Acceptance
All four suites green from a clean checkout with one root command; counts recorded. This is the compile/test baseline every later ticket measures against.

## Write scope
package.json files, test fixtures and mocks, deleted dead tests. No production code changes beyond what a test exposes as a real bug (log those separately).

## Work Log
### [2026-09-16T17:05:28Z] codex
Execution started after beta-plan review. Local critical path: restore package/root test gates and record baseline counts before W1.
### [2026-09-16T17:14:35Z] codex
Gate green: root npm run test:run passes with local loopback permission. Counts: debrief 26 files/137 tests; SDK 16/175; mcp-server 9/66; authz 4/45; web 16/102. Total 525 tests. Added package scripts/root all-workspace gate, SST/Next test isolation, current schema fixtures and migrated stale expectations.