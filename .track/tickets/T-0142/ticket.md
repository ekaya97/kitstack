---
id: T-0142
title: "Demo baseline: install dependencies, record checks, checkpoint untracked kits"
status: done
priority: critical
created: "2026-09-14T20:49:54Z"
created_by: human
claimed_by: project-manager
claimed_at: "2026-09-14T22:08:42Z"
labels:
  - sales-voice
  - demo
  - baseline
branch: null
files: []
depends_on: []
---

## Description

Before implementation: run npm install at the repository root; record npx tsc --noEmit -p tsconfig.json exit code/error count and npm run test:run pass/fail counts; create the demo branch; explicitly git-add and commit kits/adint and kits/fressnapf so the untracked user work is recoverable. Define compile check as no increase from baseline and test check as no increase in failing tests. Exclude .next and ignored build artifacts from reference counts.

## Work Log
### [2026-09-14T20:58:04Z] project-manager
Baseline: root npm install completed with escalation. Exact npm run test:run remains blocked in the normal sandbox (vitest: command not found); kit-local TypeScript ./kits/adint/node_modules/.bin/tsc --noEmit -p tsconfig.json passes with 0 errors. Untracked kits checkpointed in 6f3ff4e on demo-sales-voice-agent. Baseline compile=0 errors; baseline test command unavailable.
### [2026-09-14T22:08:42Z] project-manager
Baseline complete: npm install succeeded; root tsc passed 0 errors; root test:run is a no-test-files baseline failure; kits/adint and kits/fressnapf checkpointed in 6f3ff4e on demo-sales-voice-agent. Package demo gates now provide the executable test baseline.
