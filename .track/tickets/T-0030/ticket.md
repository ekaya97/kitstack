---
id: T-0030
title: "Migrate outreach kit: views + loaders"
status: done
priority: high
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-papa
claimed_at: "2026-04-25T16:09:37Z"
labels:
  - migration
branch: null
files: []
depends_on:
  - T-0029
---

## Description

Add views to kits/outreach/: sequence-builder, prospect-list, email-preview. Each view has index.ts (defineView), loader.ts (calls tool.load()), View.tsx (accepts {data} props). Wire in kit.config.ts. Reference: kits/crm/src/views/ for the pattern, deprecated/views/outreach/ for the original UI components.

## Work Log