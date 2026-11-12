---
id: T-0032
title: "Migrate expense kit to SDK pattern"
status: done
priority: medium
created: "2026-04-25T15:44:17Z"
created_by: human
claimed_by: agent-romeo
claimed_at: "2026-04-25T16:16:42Z"
labels:
  - migration
branch: null
files: []
depends_on: []
---

## Description

Full migration of expense kit to kits/expense/. 7 tools (add_expense, list_expenses, categorize, update_expense, quarterly_summary, export_steuerberater, import_csv), 4 views (expense-table, category-dashboard, import-review, steuerberater-export). Follow CRM pattern exactly. Reference: deprecated/kit-definitions/kits/expense/ and deprecated/views/expense/.

## Work Log