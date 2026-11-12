---
id: T-0088
title: "Admin: dashboard with kit activations overview"
status: done
priority: medium
created: "2026-04-26T18:53:25Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - web
branch: null
files: []
depends_on:
  - T-0082
  - T-0086
---

## Description

Build the admin dashboard at `web/src/app/admin/dashboard/` as the main admin landing page.

### What it needs

1. **Summary cards**: total users, active subscriptions, total kit activations, total skill downloads
2. **Kit activations table**: cross-board view of all activations from `kit_activations` — user, kit, status, timestamps
3. **Filters**: filter activations by kit, by status (active/deactivated/archived), by date range
4. **Links**: each row links to the relevant user detail (T-0086) and kit detail (T-0082)
5. **Top skills by downloads**: ranked list, sortable
6. **Top kits by activations**: ranked list, sortable

### Existing code

- `web/src/db/schema.ts` — `kitActivations`, `skillDownloads`, `subscriptions` tables
- `web/src/app/admin/layout.tsx` — add Dashboard at top of sidebar, make it the default redirect from /admin

### Notes

- This replaces the current /admin redirect to /admin/skills — dashboard becomes the admin home
- Kit activations are the central join table between users and kits — the dashboard is where you see the full picture

## Work Log
### [2026-04-26T19:10:22Z] agent-alpha
Built admin dashboard. API endpoint runs 19 parallel queries for all platform stats. Dashboard page shows: 8 summary cards (users, subscriptions, activations, downloads, skills, kits, reviews, MRR), subscription breakdown table, top 5 skills by downloads, top 5 kits by activations, skills by category bar chart, recent users/reviews/activations/downloads feeds. Sidebar updated with Dashboard at top, /admin now redirects to /admin/dashboard.