---
id: T-0041
title: "View DevKit: host UI (sidebar + panels)"
status: done
priority: medium
created: "2026-04-25T15:44:18Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T16:28:37Z"
labels:
  - devkit
branch: null
files: []
depends_on:
  - T-0040
  - T-0041
---

## Description

Create packages/sdk/src/devkit/index.html + app. Vite app with: sidebar listing all views from kit.config.ts, viewport with double iframe, panels for viewport sizing, capability toggles, data inspector (editable JSON), tool call log. Wire kitstack dev --views command to start this.

## Work Log