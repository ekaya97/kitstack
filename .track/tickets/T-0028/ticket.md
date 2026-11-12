---
id: T-0028
title: "Dev server: __load_view command for reload()"
status: done
priority: medium
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T16:10:27Z"
labels:
  - dev-server
branch: null
files: []
depends_on:
  - T-0025
---

## Description

Add __load_view command handling to the kit tool dispatch (T-0025). When a view calls callTool('__load_view', {view: slug}), the server re-runs the loader and returns fresh data as JSON. This enables useKit().reload() in views. Reference: packages/mcp-server/src/router/kit-handler.ts __load_view handler.

## Work Log