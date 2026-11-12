---
id: T-0015
title: "Validation: Zod field .describe() warnings"
status: done
priority: medium
created: "2026-04-25T15:44:16Z"
created_by: human
claimed_by: agent-hotel
claimed_at: "2026-04-25T16:00:34Z"
labels:
  - sdk-core
branch: null
files: []
depends_on:
  - T-0014
---

## Description

Add a validateToolArgs() function that inspects Zod schemas for missing .describe() on fields. Called by defineKit() — logs warnings to stderr (doesn't throw). Important for MCP tool quality. See plan section 2.4.

## Work Log