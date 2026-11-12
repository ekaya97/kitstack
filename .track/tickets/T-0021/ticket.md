---
id: T-0021
title: "CLI: entry point + command routing"
status: done
priority: high
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-hotel
claimed_at: "2026-04-25T15:58:34Z"
labels:
  - cli
branch: null
files: []
depends_on: []
---

## Description

Create packages/sdk/src/cli/index.ts as the CLI entry point. Route subcommands: init, dev, build, login, publish. Use commander or citty for arg parsing. Register as bin in package.json. Running 'npx kitstack' should show help. This is just the scaffold — individual commands are separate tickets.

## Work Log