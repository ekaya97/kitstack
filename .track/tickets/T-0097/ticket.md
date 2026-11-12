---
id: T-0097
title: "Test full kit deployment flow: CLI deploy and publish to public"
status: done
priority: high
created: "2026-04-27T19:19:25Z"
created_by: human
claimed_by: agent-bravo
claimed_at: "2026-05-06T07:33:53Z"
labels:
  - cli
  - deployment
  - testing
branch: null
files: []
depends_on: []
---

## Description

End-to-end test of the kit deployment pipeline using the CLI. Verify that a developer can build, deploy, and publish a kit — and that a user can discover and activate it.

Steps to test:
1. kitstack build — verify manifest includes kitDescription, kitTriggers, kitInstructions
2. kitstack deploy — verify S3 upload, registry seed (with triggers/instructions), Lambda provisioning (128MB, 10s, concurrency 5)
3. kitstack publish — verify kit becomes publicly visible
4. Manually update system kits (crm, expense, outreach, meeting) to public visibility
5. Verify a fresh user can discover, activate, and use a public kit via Claude.ai

Also verify:
- waitUntilFunctionUpdatedV2 handles back-to-back deploys without ResourceConflictException
- Registry correctly stores kitDescription (was using kitName — fixed), kitTriggers, kitInstructions
- Dynamic tool description reflects public kits for new users
- Security controls apply to newly deployed kits (timeout, memory, concurrency verified by verify-security.ts)

## Work Log
### [2026-07-20T19:14:53Z] claude
Closing: superseded by pivot. Public self-serve CLI deploy is being removed (WS1 owner-only deploy, docs/company-pivot-plan.md). Testing the public publish flow no longer applies.