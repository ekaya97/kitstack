---
id: T-0010
title: "SDK: serve() runtime for self-hosting"
status: done
priority: medium
created: "2026-04-25T15:41:31Z"
created_by: human
claimed_by: agent-echo
claimed_at: "2026-04-25T16:14:06Z"
labels:
  - sdk
  - runtime
branch: null
files: []
depends_on: []
---

## Description

Implement serve() at packages/sdk/src/server/. Batteries-included MCP server: MCP JSON-RPC protocol, two-tool split (kit + kit_view), loader execution, view serving, DB connection management, auth adapters (none, kitstack, oauth). See docs/sdk-architecture-plan.md section 10.3. Must support: single kit, monolith (multiple kits), stdio + HTTP transports, relay connection.

## Work Log