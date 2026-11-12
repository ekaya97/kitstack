---
id: T-0017
title: "Testing: loader testing in createTestKit"
status: done
priority: medium
created: "2026-04-25T15:44:16Z"
created_by: human
claimed_by: agent-papa
claimed_at: "2026-04-25T16:08:48Z"
labels:
  - sdk-core
branch: null
files: []
depends_on:
  - T-0016
---

## Description

Extend TestKit (from T-0016) with loadView(viewSlug, ctx?) that executes a view's loader against the test DB and returns typed data. Allows testing loaders without MCP protocol overhead. Reference: kits/crm/src/views/*/loader.ts.

## Work Log