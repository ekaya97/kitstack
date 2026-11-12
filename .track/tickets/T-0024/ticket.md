---
id: T-0024
title: "Dev server: MCP JSON-RPC protocol handler"
status: done
priority: high
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-alpha
claimed_at: "2026-04-25T15:59:33Z"
labels:
  - dev-server
branch: null
files: []
depends_on: []
---

## Description

Create packages/sdk/src/runtime/mcp-handler.ts. Handles initialize (with io.modelcontextprotocol/ui extension), tools/list, tools/call. Stateless function: handleMcpRequest(method, params, kit, db, ctx) → JsonRpcResponse. This is the core protocol layer shared by kitstack dev and serve(). Reference: packages/mcp-server/src/router/mcp-protocol.ts for the production implementation.

## Work Log