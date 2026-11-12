---
id: T-0093
title: "Implement always-allow and always-block permissions per kit action category"
status: done
priority: high
created: "2026-04-27T11:58:08Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - permissions
  - mcp-server
  - dashboard
branch: null
files: []
depends_on: []
---

## Description

Server-side permission enforcement in the MCP router. Users configure per-kit permissions in the dashboard, enforced before executeTool in tool-dispatcher.ts.

Categories based on tool naming convention:
- Read (list_*, search_*, get_*) — default: allow
- Write (add_*, update_*) — default: allow
- Delete (delete_*, archive_*) — default: block
- Export (export_*, generate_*) — default: allow

Implementation:
1. Add permissions table/config (user_id, kit_id, category, permission)
2. Add permission check in tool-dispatcher.ts before executeTool
3. Dashboard UI: per-kit expandable permissions section with category toggles
4. Return clear error message when blocked: "Action blocked by your permissions. Update in KitStack dashboard."

No MCP client support needed — this is entirely server-side. Deferred: ask-before-allow pattern (requires Chrome extension, see permissions_design memory).

## Work Log
### [2026-07-20T19:14:53Z] claude
Closing: superseded by WS5 org/role-based access control (org roles + per-tool authorize() hook) in docs/company-pivot-plan.md. New WS5 tickets cover access control.