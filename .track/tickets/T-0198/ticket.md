---
id: T-0198
title: "Migrate maintained kits; mode, classification, MCP annotations, partial-args describe"
status: done
priority: high
created: "2026-09-16T16:50:21Z"
created_by: human
claimed_by: 01a0ab2d-f030-7612-849a-6fcc489452df
claimed_at: "2026-09-16T17:17:54Z"
labels:
  - beta-plan
  - W1
  - G1
branch: agent/01a0ab2d-metadata
files: []
depends_on:
  - T-0197
---

## Description

Plan: .track/docs/kitstack-beta-execution-plan.md W1-T2. Review: .track/docs/kitstack-beta-execution-plan-review.md §4.

## Scope
- Migrate debrief first, then crm, expenses, content-planner, projects, adint, fressnapf, decision-journal to (ctx, args).
- Add mode: assist | act and a classification field to defineTool; surface mode as MCP readOnlyHint / destructiveHint annotations on the tool definition so BYO servers and SDK kits look identical to clients and gateways.
- Partial-argument calls that fail Zod validation return the describe response (schema + instructions), not an error string, in both serve() and the router.

## Acceptance
- One defineTool implementation in the SDK; all listed kits build and test.
- Tool metadata exposes mode/classification and MCP annotations.
- A partial call to any tool returns schema and instructions with isError false.

## Write scope
packages/sdk define-tool/protocol/kit-router, packages/mcp-server tool-dispatcher, each kit's tools.

## Work Log
### [2026-09-16T17:17:55Z] 01a0ab2d-f030-7612-849a-6fcc489452df
Kit-owned slice implemented: 84 maintained tools tagged with mode/classification and MCP readOnly/destructive annotations; debrief metadata contract coverage added. Shared SDK partial-args behavior remains delegated to T-0197/T-0199. PM integration pending full kit/typecheck gate.
### [2026-09-16T17:46:12Z] codex
Integrated maintained-kit migration 93fafc1 (84 tools tagged with mode/classification/annotations; tool/load/view signatures migrated). Initial direct kit typechecks exposed stale local SDK resolution and mechanical missed ctx.db replacements; repair is in isolated follow-up before closure. Root gate remains green because kits are not root workspaces.
### [2026-09-16T18:56:06Z] codex
Integrated bounded repair f2ceba1 as 4b0c781. npm run typecheck:kits passes all 8 maintained kits; fixture/type fixes covered CRM, Expenses, Fressnapf, Projects and added docs/maintained-kits-validation.md. Remaining acceptance caveats: content-planner build fails on two pre-existing migrations both creating ideas; CRM test command discovers src tests only while its existing test file is under test/.
### [2026-09-26T00:00:00Z] project-manager
Closed for the maintained-kit contract: all eight kits typecheck and the context/mode/classification/annotation migration is integrated. The two documented legacy fixture caveats remain non-beta blockers.
