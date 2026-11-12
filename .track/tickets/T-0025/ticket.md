---
id: T-0025
title: "Dev server: two-tool split (kit + kit_view)"
status: done
priority: high
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-quebec
claimed_at: "2026-04-25T16:06:10Z"
labels:
  - dev-server
branch: null
files: []
depends_on:
  - T-0024
---

## Description

Extend the MCP handler (T-0024) with the two-tool split. Register kit (text-only CRUD) and kit_view (renders iframe) tools. kit() lists tools, kit(cmd) describes, kit(cmd, params) runs. kit_view(view) executes loader, builds embedded resource with shell HTML + pre-loaded data. Reference: packages/mcp-server/src/router/kit-handler.ts and docs/mcp-apps.md for the protocol.

## Work Log