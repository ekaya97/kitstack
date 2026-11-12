---
id: T-0027
title: "Dev server: local SQLite provisioning"
status: done
priority: medium
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-quebec
claimed_at: "2026-04-25T16:02:43Z"
labels:
  - dev-server
branch: null
files: []
depends_on: []
---

## Description

Create packages/sdk/src/runtime/dev-db.ts. provisionDevDb(dbPath, migrationSql, {reset?}) creates .kitstack/dev.db, runs migrations, returns Drizzle client. Already partially exists in the plan — implement it cleanly with error handling. Used by kitstack dev.

## Work Log