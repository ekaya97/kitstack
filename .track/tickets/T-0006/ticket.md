---
id: T-0006
title: "SDK: View DevKit (kitstack dev --views)"
status: done
priority: medium
created: "2026-04-25T15:41:31Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T16:31:30Z"
labels:
  - sdk
  - cli
  - views
branch: null
files: []
depends_on: []
---

## Description

Local MCP Apps renderer for view development. Same double iframe + postMessage protocol as Claude.ai but on localhost with Vite HMR. Sidebar to switch views, viewport sizing, capability toggles, data inspector, tool call log. See docs/sdk-architecture-plan.md section 8.4 for full spec. Ships at packages/sdk/src/devkit/. Must handle sandbox-proxy-ready handshake, ui/initialize, tool-result notification — same as production.

## Work Log