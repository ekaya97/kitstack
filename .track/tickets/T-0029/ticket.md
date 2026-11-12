---
id: T-0029
title: "Migrate outreach kit: tools"
status: done
priority: high
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-papa
claimed_at: "2026-04-25T16:02:47Z"
labels:
  - migration
branch: null
files: []
depends_on: []
---

## Description

Create kits/outreach/ with SDK-pattern tools. Copy schema.ts, migrations.ts, instructions.ts from deprecated/kit-definitions/kits/outreach/. Rewrite all 11 tools using defineTool with load() where applicable (list_sequences, export_sequence are read tools). Write tools (create_sequence, add_prospect, etc.) keep handler-only. Reference: kits/crm/src/tools/ for the pattern.

## Work Log