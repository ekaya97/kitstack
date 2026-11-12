---
id: T-0094
title: "Write tool responses must return structured IDs for workflow chaining"
status: done
priority: high
created: "2026-04-27T12:20:57Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - sdk
  - bug
  - kits
branch: null
files: []
depends_on: []
---

## Description

Kit write actions (add_contact, add_deal, add_activity, etc.) return human-readable prose instead of structured IDs. This breaks multi-step workflow chaining — the LLM cannot pass a created deal's ID into a subsequent add_activity call. Discovered during Claude.ai testing: add_deal returned 'Deal created in prospect — €25,000' with no ID, so the activity could not be linked to the deal. Every mutation handler must return at minimum { id, name, status } in a parseable format. Audit all kit tool handlers across crm, expense, outreach, and meeting kits. Consider adding an SDK convention or helper (e.g. kit.created(id, name)) to enforce consistent write responses.

## Work Log