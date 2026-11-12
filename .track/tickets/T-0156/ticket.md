---
id: T-0156
title: "Standard local MCP harness for sales demo"
status: done
priority: high
created: "2026-09-15T10:19:16Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - sales-voice
  - mcp
  - dogfood
branch: null
files: []
depends_on: []
---

## Description

Provide a process-based local MCP entrypoint or adapter that exercises initialize, tools/list, tools/call, ping, and notifications against the demo services. Add a reproducible config/runbook and a client-compatible test; do not replace the HTTP demo server.

## Work Log
### [2026-09-15T10:23:40Z] codex
Implemented standard demo MCP stdio lifecycle and tool adapter; focused tests and demo TypeScript check pass.
