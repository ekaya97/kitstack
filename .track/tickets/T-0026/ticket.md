---
id: T-0026
title: "Dev server: stdio transport"
status: done
priority: high
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T16:05:04Z"
labels:
  - dev-server
branch: null
files: []
depends_on:
  - T-0024
---

## Description

Create packages/sdk/src/runtime/stdio.ts. Reads JSON-RPC from stdin, writes responses to stdout. Wraps the MCP handler from T-0024. This is what kitstack dev --stdio uses. Reference: the MCP SDK's StdioServerTransport for the wire format (newline-delimited JSON).

## Work Log