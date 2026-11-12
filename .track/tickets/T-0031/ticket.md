---
id: T-0031
title: "Migrate outreach kit: handler + deploy"
status: done
priority: medium
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-romeo
claimed_at: "2026-04-25T16:19:55Z"
labels:
  - migration
branch: null
files: []
depends_on:
  - T-0030
---

## Description

Create kits/outreach/handler.ts (bridges SDK tools to Lambda invocation format, handles both tool and loader invocations). Create build.ts and upload.ts. Update infra/mcp.ts handler path. Seed kit_views registry. Build, upload to CDN, test end-to-end.

## Work Log