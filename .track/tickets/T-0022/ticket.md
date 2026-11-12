---
id: T-0022
title: "CLI: kitstack init scaffolding"
status: done
priority: high
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-papa
claimed_at: "2026-04-25T16:04:13Z"
labels:
  - cli
branch: null
files: []
depends_on:
  - T-0021
---

## Description

Implement kitstack init <name>. Creates directory with: kit.config.ts, package.json, tsconfig.json, src/schema.ts, src/migrations.ts, src/instructions.ts, src/tools/example.ts, src/views/dashboard/{index.ts,loader.ts,View.tsx}, tailwind.config.ts. Templates at packages/sdk/src/templates/default/. Use @clack/prompts for interactive UX. Reference: kits/crm/ for the target structure.

## Work Log