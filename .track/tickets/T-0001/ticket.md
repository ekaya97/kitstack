---
id: T-0001
title: "SDK: Testing framework (createTestKit)"
status: done
priority: high
created: "2026-04-25T15:41:30Z"
created_by: human
claimed_by: agent-alpha
claimed_at: "2026-04-25T15:58:48Z"
labels:
  - sdk
  - testing
branch: null
files: []
depends_on: []
---

## Description

Implement createTestKit() at packages/sdk/src/testing/. Creates in-memory SQLite, runs migrations, provides call(toolName, args), callAs(ctx, toolName, args), reset(), cleanup(). See docs/sdk-architecture-plan.md section 5. Reference: packages/sdk/src/types.ts for KitDefinition, KitToolResult. The CRM kit at kits/crm/ is the test subject — createTestKit(crmKit) should work.

## Work Log