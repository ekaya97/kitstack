---
id: T-0038
title: "serve(): main entry point"
status: done
priority: medium
created: "2026-04-25T15:44:18Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T16:12:36Z"
labels:
  - runtime
branch: null
files: []
depends_on:
  - T-0037
  - T-0038
---

## Description

Create packages/sdk/src/server/index.ts. serve({kit, auth, db, port, transport}) wires together: MCP handler + transport (HTTP or stdio) + auth adapter + DB connection. Single kit mode and monolith mode (kits array). Export from package.json as './server'.

## Work Log