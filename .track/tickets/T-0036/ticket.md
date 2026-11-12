---
id: T-0036
title: "serve(): HTTP transport"
status: done
priority: medium
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T16:14:07Z"
labels:
  - runtime
branch: null
files: []
depends_on:
  - T-0024
---

## Description

Create packages/sdk/src/server/http.ts. HTTP server that handles MCP requests at POST /. Uses the MCP handler from T-0024. Serves OAuth endpoints (/.well-known/oauth-authorization-server, /authorize, /token, /revoke) delegated to an auth adapter. This is what self-hosted kits use.

## Work Log