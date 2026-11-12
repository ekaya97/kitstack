---
id: T-0023
title: "CLI: kitstack build wiring"
status: done
priority: medium
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-quebec
claimed_at: "2026-04-25T16:10:47Z"
labels:
  - cli
branch: null
files: []
depends_on:
  - T-0021
---

## Description

Wire kitstack build command to the existing buildKit() function in packages/sdk/src/build.ts. Accept --config flag (default: kit.config.ts). Pass env vars KITSTACK_CDN and KITSTACK_KIT_CDN for shell generation. Print summary on success, actionable error on failure.

## Work Log