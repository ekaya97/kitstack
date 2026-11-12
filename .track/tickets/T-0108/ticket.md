---
id: T-0108
title: "kitstack skills CLI: search, install, and track skill downloads"
status: done
priority: high
created: "2026-05-08T07:21:50Z"
created_by: agent-bravo
claimed_by: agent-bravo
claimed_at: "2026-05-08T07:21:50Z"
labels:
  - cli
  - sdk
  - skills
branch: null
files: []
depends_on: []
---

## Description

Add skills subcommand to kitstack CLI for searching, browsing, and installing skills into coding harnesses. Commands: kitstack skills search <query> (semantic search via embeddings), kitstack skills list (browse by category), kitstack skills install <slug> --to <harness> (install to claude/cursor/codex/opencode). Harness flag --to writes to correct location (CLAUDE.md, .cursor/rules, AGENTS.md). kitstack init gets --to flag to scaffold base harness file with skill discovery instructions. Track CLI downloads same as web downloads (skill_downloads table + analytics). Semantic search enables agents to self-discover and install skills on the fly. Skills sourced from platform API. Dev skills (kit-builder, tool-iterator) at scripts/skills/.

## Work Log
### [2026-07-20T19:14:54Z] claude
Closing: skills marketplace CLI is obsolete after pivot to company-internal MCP tool.