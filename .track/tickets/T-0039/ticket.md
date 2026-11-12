---
id: T-0039
title: "View DevKit: mock MCP Apps host"
status: done
priority: medium
created: "2026-04-25T15:44:18Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T16:25:15Z"
labels:
  - devkit
branch: null
files: []
depends_on: []
---

## Description

Create packages/sdk/src/devkit/host.ts. Implements the MCP Apps postMessage protocol that Claude.ai uses: responds to ui/initialize, sends tool-result notifications, handles tools/call (routes to kit handlers), handles ui/download-file and ui/open-link. This is the core of the View DevKit.

## Work Log