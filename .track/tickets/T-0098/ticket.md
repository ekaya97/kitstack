---
id: T-0098
title: "Skill: Kit Developer — Claude Code agent for building kits with KitStack SDK"
status: done
priority: high
created: "2026-04-27T20:45:59Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - skills
  - developer-experience
  - bootstrap
branch: null
files: []
depends_on: []
---

## Description

A Claude Code skill that guides developers through building kits with the KitStack SDK. This is the first bootstrap skill — we use it ourselves to build the system kits, then ship it to developers.

## What it does
- Scaffolds a new kit from a description (tools, schema, views, instructions, triggers)
- Knows the SDK API: defineKit, defineTool, defineView, defineLoader, kit.result/kit.created/kit.text
- Follows best practices: snake_case tool names, descriptive args with .describe(), mutation tools use kit.result(kit.created(...)), trigger keywords for discoverability
- Generates migrations from schema definitions
- Writes instructions that match the kit's domain (behavioral guidelines, trigger phrases)
- Knows the deploy flow: build → deploy → seed registry

## Sources of knowledge
- SDK types: packages/sdk/src/types.ts
- Result helpers: packages/sdk/src/result.ts
- defineKit validation: packages/sdk/src/define-kit.ts
- Existing kits as examples: kits/crm/, kits/expense/, kits/outreach/, kits/meeting/
- Developer docs: web/content/docs/

## Depends on
- T-0092 (server adapter) — the skill should reference the final architecture, not the current dual-code-path setup

## Work Log
### [2026-07-20T19:14:54Z] claude
Closing as done: kit-builder-skill exists and is registered in .claude/skills.