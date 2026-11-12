---
id: T-0099
title: "Skill: Tool Iterator — local kit executor for LLM-driven testing and improvement"
status: done
priority: high
created: "2026-04-27T20:46:19Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - skills
  - developer-experience
  - bootstrap
  - testing
branch: null
files: []
depends_on: []
---

## Description

A Claude Code skill that runs kit tools locally without a relay or MCP server. Claude Code calls kit() directly in-process, reasons about the workflow, evaluates return data, and suggests improvements from the LLM's perspective.

## What it does
- Loads a kit from kit.config.ts in the current directory
- Creates an in-memory SQLite database, runs migrations
- Exposes kit(id, cmd, params) as a callable tool within the Claude Code session
- Executes tool handlers directly (same as the local adapter from T-0092)
- After each call, evaluates: are the return values useful for chaining? Are descriptions clear? Is the action list discoverable?
- Suggests improvements: missing IDs in write responses, unclear param descriptions, missing triggers, workflow gaps

## Example workflow
```
User: "test my kit"
Skill: loads kit.config.ts, runs migrations
Skill: calls kit() → lists actions
Skill: calls kit(id, "add_contact", { name: "Test User" })
Skill: evaluates response — "add_contact returns a contact ID, good for chaining"
Skill: calls kit(id, "add_deal", { name: "Test Deal", contactId: "<from previous>" })
Skill: evaluates — "add_deal returns deal ID, can chain to add_activity"
Skill: runs full workflow, reports: "3/3 mutations return IDs, all actions discoverable, suggest adding 'customer' to triggers"
```

## Architecture
Uses the local adapter from T-0092 (packages/sdk/src/server/adapters/local.ts). The skill wraps it as a Claude Code tool — no MCP server, no relay, no network. Just in-process tool execution against a local database.

## Depends on
- T-0092 (server adapter refactor) — the local adapter is the foundation
- T-0098 (Kit Developer skill) — the two skills work together: build with #1, test with #2

## Work Log
### [2026-07-20T19:14:54Z] claude
Closing as done: tool-iterator-skill exists and is registered in .claude/skills.