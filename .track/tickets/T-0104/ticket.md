---
id: T-0104
title: "Comprehensive structured logging: replace console.* and fill gaps across web + MCP router"
status: done
priority: high
created: "2026-05-06T10:44:28Z"
created_by: human
claimed_by: agent-alpha
claimed_at: "2026-05-06T17:43:07Z"
labels:
  - web
  - mcp
  - observability
  - posthog
branch: null
files: []
depends_on: []
---

## Description

/tmp/ticket-desc.txt

## Work Log
### [2026-05-06T17:51:23Z] agent-alpha
Committed 048c05a: 15 files, 6 phases — replaced all console.* in router/services, added request/auth/error logging across both web and MCP server
### [2026-09-26T00:00:00Z] project-manager
Reconciled as complete: commit `048c05a` is an ancestor of `f4c9f5f` and the
web/MCP structured logging slice is integrated. Remaining SDK CLI/template
console output is intentional operator/user output, not this ticket's web/MCP
runtime scope.
