---
id: T-0016
title: "Testing: createTestKit() with in-memory SQLite"
status: done
priority: high
created: "2026-04-25T15:44:16Z"
created_by: human
claimed_by: agent-romeo
claimed_at: "2026-04-25T15:57:47Z"
labels:
  - sdk-core
branch: null
files: []
depends_on: []
---

## Description

Create packages/sdk/src/testing/index.ts. createTestKit(kitDefinition) creates in-memory SQLite via @libsql/client, runs migrationSql, returns TestKit with: db (Drizzle client), call(toolName, args), callAs(ctx, toolName, args), reset(), cleanup(). Must handle both load() and handler() tools. Reference: kits/crm/ as test subject, plan section 5.

## Work Log