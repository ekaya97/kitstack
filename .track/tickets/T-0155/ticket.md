---
id: T-0155
title: "Demo MCP auth gate with app tokens"
status: done
priority: critical
created: "2026-09-15T10:19:00Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - sales-voice
  - auth
  - mcp
branch: null
files: []
depends_on: []
---

## Description

Add an explicit demo MCP auth mode. Keep auth-none only for loopback; support Bearer app-token validation for /mcp and document the controlled-tunnel behavior. Preserve the existing proxy auth contract. Add tests for missing, invalid, and valid tokens.

## Work Log