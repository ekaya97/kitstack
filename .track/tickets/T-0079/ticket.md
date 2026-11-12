---
id: T-0079
title: "Dev: beautify dev server console output"
status: done
priority: low
created: "2026-04-26T13:10:45Z"
created_by: human
claimed_by: agent-alpha
claimed_at: "2026-04-26T18:33:52Z"
labels:
  - cli
branch: null
files: []
depends_on: []
---

## Description

## Description

Improve the `kitstack dev` console output for both stdio and relay modes. Currently functional but plain — should be clear, informative, and visually clean.

### Current state

Relay mode prints:
```
  CRM Kit dev server
  Connecting to relay...

  Connected! Public URL:
  https://d334d0ihf1hsg4.cloudfront.net/dev/67c99a1f

  Add this URL to your LLM client's MCP server list.
  Press Ctrl+C to stop.

  ← tools/list {}
  → OK (tools/list)
  ← asset .kitstack/devkit-entries/dashboard.tsx
  → 200 (text/javascript)
```

### Improvements

1. **Startup banner**: kit name, version, tool/view count, DB path, mode (stdio/relay/views)
2. **Request logging**: color-coded by type (MCP=blue, asset=gray, error=red), timing in ms
3. **Tool calls**: show tool name prominently, args truncated, result status
4. **Asset requests**: dimmed/compact — less visual noise than MCP requests
5. **Connection status**: clear indicators for connected/disconnected/reconnecting
6. **Errors**: red with context (not just "ERROR")

### Files to modify

- `packages/sdk/src/runtime/relay-client.ts` — relay mode logging (~line 88-104)
- `packages/sdk/src/cli/commands/dev.ts` — startup banner + stdio mode logging

### Constraints

- All output goes to `stderr` (stdout is reserved for stdio JSON-RPC)
- No external dependencies (no chalk/kleur — use ANSI escape codes directly)
- Keep it minimal — this is a dev tool, not a dashboard


## Work Log