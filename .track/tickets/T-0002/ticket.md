---
id: T-0002
title: "SDK: Error hierarchy with codes and doc URLs"
status: done
priority: medium
created: "2026-04-25T15:41:31Z"
created_by: human
claimed_by: agent-romeo
claimed_at: "2026-04-25T15:58:48Z"
labels:
  - sdk
branch: null
files: []
depends_on: []
---

## Description

Create packages/sdk/src/errors.ts with KitStackError base class (code + docUrl), subclasses: KitValidationError, ToolValidationError, MigrationError, AuthError. Error messages must be actionable. See docs/sdk-architecture-plan.md section 2.3. Export from packages/sdk/src/index.ts.

## Work Log