---
id: T-0013
title: "Error hierarchy: KitStackError base + subclasses"
status: done
priority: high
created: "2026-04-25T15:44:16Z"
created_by: human
claimed_by: claude
claimed_at: "2026-04-25T15:50:06Z"
labels:
  - sdk-core
branch: null
files: []
depends_on: []
---

## Description

Create packages/sdk/src/errors.ts. KitStackError with code + docUrl. Subclasses: KitValidationError, ToolValidationError, MigrationError, SchemaError. Each error message must be actionable (say what to fix, not just what's wrong). Export from index.ts. See plan section 2.3.

## Work Log