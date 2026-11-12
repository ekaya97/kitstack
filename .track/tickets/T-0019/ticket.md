---
id: T-0019
title: "Build: tool/view validation step"
status: done
priority: medium
created: "2026-04-25T15:44:16Z"
created_by: human
claimed_by: agent-delta
claimed_at: "2026-04-25T16:04:57Z"
labels:
  - build
branch: null
files: []
depends_on:
  - T-0014
---

## Description

In the build pipeline (packages/sdk/src/build.ts), add validation after loading kit.config.ts: snake_case tool names, description length, view slug format, component file exists (View.tsx convention). Use the validation functions from T-0014. Fail build on errors, warn on missing .describe().

## Work Log