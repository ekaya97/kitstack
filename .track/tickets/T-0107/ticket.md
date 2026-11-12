---
id: T-0107
title: "Blue/green kit deploys: automatic background migration (Phase 2)"
status: done
priority: medium
created: "2026-05-07T15:10:30Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - infra
  - sdk
branch: null
files: []
depends_on:
  - T-0106
---

## Description

Automatic migration runner: deploy triggers inline migration for all users, delta computation from migrations directory, failure handling and rollback. SQS-based async migration for scale. See docs/blue-green-kit-deploys.md for full design.

## Work Log
### [2026-07-20T19:14:54Z] claude
Closing: depends on T-0106 blue/green design, which is dropped with the pivot (see T-0106 log).