---
id: T-0105
title: "Port remaining CRM views from deprecated to SDK"
status: done
priority: high
created: "2026-05-06T20:40:56Z"
created_by: agent-bravo
claimed_by: agent-bravo
claimed_at: "2026-05-06T20:40:56Z"
labels:
  - kit
  - views
  - crm
branch: null
files: []
depends_on: []
---

## Description

Port Dashboard and Contact Detail views from deprecated/views/crm/ to SDK-driven CRM kit at kits/crm/. Dashboard needs summary cards (Total/Open/Won), bar chart by stage, activity feed. Contact Detail needs header card, deals list with stage badges, activity timeline. Use defineView/defineLoader/useKit. Reference deprecated/views/ at localhost:5180.

## Work Log