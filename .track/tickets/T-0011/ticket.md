---
id: T-0011
title: "Router: Remove hardcoded kit maps"
status: done
priority: high
created: "2026-04-25T15:41:31Z"
created_by: human
claimed_by: agent-papa
claimed_at: "2026-04-25T16:14:48Z"
labels:
  - router
branch: null
files: []
depends_on: []
---

## Description

The router at packages/mcp-server/src/router/ still has hardcoded maps: KIT_APPS (in app-resources.ts — partially done, fallback map remains for non-CRM kits), VIEW_DATA (in kit-handler.ts), KIT_RESOURCE_MAP and KIT_ID_TO_SLUG (in tool-dispatcher.ts). All should read from the kit_views and kit_registry tables in Turso. The CRM kit already uses the registry — extend to all kits. See docs/sdk-session-notes.md infrastructure changes table.

## Work Log