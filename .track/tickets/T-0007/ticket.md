---
id: T-0007
title: "Migrate outreach kit to SDK pattern"
status: done
priority: high
created: "2026-04-25T15:41:31Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T16:23:59Z"
labels:
  - kits
  - migration
branch: null
files: []
depends_on: []
---

## Description

Rebuild the outreach kit at kits/outreach/ using the SDK pattern. Reference: kits/crm/ (working prototype) and deprecated/kit-definitions/kits/outreach/ (old implementation). Must have: kit.config.ts, tools with load() where applicable, views with loaders that call tool.load(), View.tsx components accepting {data} props. 11 tools, 3 views. Outreach is the confirmed working kit — this migration must pass end-to-end testing with Claude.

## Work Log