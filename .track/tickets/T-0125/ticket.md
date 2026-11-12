---
id: T-0125
title: "Storage adapter — shared cross-publisher store (adint + debrief, 2-kit requirement)"
status: done
priority: high
created: "2026-09-06T18:09:16Z"
created_by: human
claimed_by: agent-alpha
claimed_at: "2026-09-16T19:38:43Z"
labels:
  - sdk
  - storage
  - adint
  - dogfood
  - stage-b
  - G2
branch: agent/t-0125-storage
files: []
depends_on: []
---

## Description

adint's core signal (a brand on competitors but not on Ströer) only exists in a SHARED cross-publisher store — the opposite of per-user libSQL. Stage A ships a labelled kit-local-SQLite shortcut (seeded snapshot), NOT the boundary. This is the same storage-adapter question as roadmap OQ5 / §8.2, now with a SECOND customer: debrief needs DynamoDB single-table, adint needs a shared relational + blob store. Two kits make it a real requirement, not a special case. Design the ctx.db plugin (libSQL | shared-SQL | object-store) with adint + debrief as its two callers. Also drives the blob/object adapter (screenshots + ad markup) and retrieval over the ad-graph. See .track/specs/adint-kit-spec.md §4, §6.

## Work Log
### [2026-09-16T16:51:08Z] agent-alpha
Beta plan review: this is W4-T1 storage adapter. Absorbs T-0130 (object store). Depends on T-0197 (context contract). libSQL is the first adapter; keep @libsql/client out of the SDK; org/tenant isolation tested at the adapter boundary.
### [2026-09-16T19:38:48Z] agent-alpha
Implemented isolated commit b47e884 on agent/t-0125-storage. Added provider-neutral SDK StorageAdapter/StorageSqlAdapter/object-store contracts without @libsql/client in the SDK; added ctx.storage compatibility seam; wired debrief persistence through the host-bound libSQL adapter; added scoped binary object storage for adint screenshots/markup. Validation: SDK storage tests 2/2, debrief adapter tests 3/3, SDK and debrief typechecks pass, debrief persistence/composition/dogfood tests 13/13 pass.
### [2026-09-16T19:39:37Z] codex
Integrated b47e884 as 70a4429. SDK now exposes provider-neutral scoped SQL/object storage contracts and ctx.storage; debrief has first-party scoped libSQL adapter, persistence wiring, and adint binary object-storage seam. Focused storage/persistence/composition tests and SDK/debrief typechecks passed; deployment-specific object-store binding remains open.
### [2026-09-26T00:00:00Z] project-manager
Reconciled against checkpoint `f4c9f5f`: the provider-neutral contracts, scoped libSQL adapter, and object-store seam are implementation-complete and locally tested. Deployment-specific binding is moved to T-0230; no external storage account is required for the beta-local path.
