---
id: T-0014
title: "Validation: tool name + description checks in defineKit"
status: done
priority: high
created: "2026-04-25T15:44:16Z"
created_by: human
claimed_by: agent-quebec
claimed_at: "2026-04-25T15:57:04Z"
labels:
  - sdk-core
branch: null
files: []
depends_on:
  - T-0013
---

## Description

Enhance defineKit() in packages/sdk/src/define-kit.ts to validate: snake_case tool names, description min 10 chars, duplicate names, duplicate view slugs, view slug kebab-case. Use KitValidationError from errors.ts. Currently only checks duplicate names. See plan section 2.4 for full validation table.

## Work Log