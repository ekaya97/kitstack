---
id: T-0004
title: "SDK: CLI dev server (kitstack dev --stdio)"
status: done
priority: high
created: "2026-04-25T15:41:31Z"
created_by: human
claimed_by: agent-delta
claimed_at: "2026-04-25T16:06:51Z"
labels:
  - sdk
  - cli
branch: null
files: []
depends_on: []
---

## Description

Implement kitstack dev --stdio for local development with Claude Desktop/Code. Loads kit.config.ts, provisions local SQLite at .kitstack/dev.db, registers kit tools + kit_view as flat MCP tools, handles MCP JSON-RPC over stdio. See docs/sdk-architecture-plan.md section 8.1. The dev server must handle tool calls, loader invocations, and the two-tool split (kit + kit_view). Reference: kits/crm/handler.ts for the handler pattern.

## Work Log