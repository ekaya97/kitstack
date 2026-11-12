---
id: T-0003
title: "SDK: CLI scaffold (kitstack init)"
status: done
priority: high
created: "2026-04-25T15:41:31Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T16:23:58Z"
labels:
  - sdk
  - cli
branch: null
files: []
depends_on: []
---

## Description

Implement kitstack init <name> command that scaffolds a new kit project. Template at packages/sdk/src/templates/default/. Output structure: kit.config.ts, src/schema.ts, src/migrations.ts, src/instructions.ts, src/tools/example.ts, src/views/dashboard/{index.ts,loader.ts,View.tsx}, tailwind.config.ts, tsconfig.json, package.json. See docs/sdk-architecture-plan.md section 7.2. Use @clack/prompts for interactive scaffolding.

## Work Log