---
id: T-0005
title: "SDK: Build pipeline hardening"
status: done
priority: medium
created: "2026-04-25T15:41:31Z"
created_by: human
claimed_by: agent-echo
claimed_at: "2026-04-25T16:07:50Z"
labels:
  - sdk
  - build
branch: null
files: []
depends_on: []
---

## Description

Harden the build at packages/sdk/src/build.ts. Currently works but needs: proper error messages with codes, validation of tool descriptions (snake_case, min length, .describe() on args), migration SQL validation against in-memory SQLite, bundle size warnings. See docs/sdk-architecture-plan.md section 7.4. The build uses esbuild for server + Vite for views (NOT esbuild for views — see session notes gotcha about React bare specifiers).

## Work Log