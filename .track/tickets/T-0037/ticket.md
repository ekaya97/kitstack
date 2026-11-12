---
id: T-0037
title: "serve(): auth adapter interface + none adapter"
status: done
priority: medium
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-papa
claimed_at: "2026-04-25T16:11:37Z"
labels:
  - runtime
branch: null
files: []
depends_on: []
---

## Description

Create packages/sdk/src/server/auth/adapter.ts with AuthAdapter interface (metadata, authorize, token, revoke, validate). Create none.ts adapter (no auth, all requests treated as default user). This is used by kitstack dev and internal tools.

## Work Log