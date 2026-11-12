---
id: T-0035
title: "Router: remove VIEW_DATA hardcoded map"
status: done
priority: high
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-delta
claimed_at: "2026-04-25T16:06:51Z"
labels:
  - router
branch: null
files: []
depends_on:
  - T-0034
---

## Description

In packages/mcp-server/src/router/kit-handler.ts, the VIEW_DATA map is still hardcoded for non-CRM kits. Remove it — handleShowApp already reads from kit_views registry for CRM. Make it the only path. Remove the fallback in app-resources.ts (KIT_APPS_FALLBACK).

## Work Log