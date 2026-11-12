---
id: T-0018
title: "Build: migration SQL validation step"
status: done
priority: medium
created: "2026-04-25T15:44:16Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T16:02:13Z"
labels:
  - build
branch: null
files: []
depends_on: []
---

## Description

In packages/sdk/src/build.ts, the migration SQL validation currently runs but needs better error messages. Run each statement individually against in-memory SQLite, catch per-statement errors with line numbers. Reject DROP statements. See plan section 7.4.1 step 3.

## Work Log