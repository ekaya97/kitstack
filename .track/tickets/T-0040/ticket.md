---
id: T-0040
title: "View DevKit: mock sandbox proxy (double iframe)"
status: done
priority: medium
created: "2026-04-25T15:44:18Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T16:28:24Z"
labels:
  - devkit
branch: null
files: []
depends_on:
  - T-0040
---

## Description

Create packages/sdk/src/devkit/proxy.html. Implements the sandbox-proxy-ready / sandbox-resource-ready handshake that Claude.ai's proxy does. Creates inner iframe, writes HTML into it. Forwards postMessage between inner iframe and host page. This ensures views work identically to production.

## Work Log