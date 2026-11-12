---
id: T-0106
title: "Blue/green kit deploys: version tracking + routing (Phase 1)"
status: done
priority: high
created: "2026-05-07T15:10:14Z"
created_by: agent-bravo
claimed_by: agent-bravo
claimed_at: "2026-05-07T15:10:14Z"
labels:
  - infra
  - sdk
  - mcp
branch: null
files: []
depends_on: []
---

## Description

MVP versioned deploys: deploy creates Kit-{id}-v{version} Lambdas, kit_versions table tracks versions, UserKitDbs gets schemaVersion field, MCP Router routes users to Lambda matching their schema version. No automatic migration — developer triggers manually. See docs/blue-green-kit-deploys.md for full design.

## Work Log
### [2026-07-20T19:14:54Z] claude
Closing: blue/green versioned deploys were designed for many independent users on divergent schema versions. With owner-only deploys and effectively one org (pivot), in-place deploy + normal migrations suffice.