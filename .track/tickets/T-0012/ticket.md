---
id: T-0012
title: "SDK: kitstack publish + deploy pipeline"
status: done
priority: low
created: "2026-04-25T15:41:31Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T18:12:18Z"
labels:
  - sdk
  - cli
  - infra
branch: null
files: []
depends_on: []
---

## Description

Implement kitstack publish command and the server-side deploy pipeline. CLI: build kit, upload bundle + view modules + manifest to S3 via KitStack API. Server: automated scanning (static analysis for dangerous imports), migration SQL validation, store in kit_submissions table, admin review queue. See docs/sdk-architecture-plan.md section 10.2 (sandbox architecture) and Phase 4.

## Work Log