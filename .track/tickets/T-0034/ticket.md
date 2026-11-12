---
id: T-0034
title: "Router: read KIT_RESOURCE_MAP from registry"
status: done
priority: high
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-quebec
claimed_at: "2026-04-25T16:00:11Z"
labels:
  - router
branch: null
files: []
depends_on: []
---

## Description

In packages/mcp-server/src/router/tool-dispatcher.ts, replace hardcoded KIT_RESOURCE_MAP and KIT_ID_TO_SLUG with registry lookups. The kit_registry table has kitId — use it to resolve Lambda ARNs via SST Resource bindings dynamically. Also update the authz slug mapping.

## Work Log