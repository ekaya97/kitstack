---
id: T-0086
title: "Admin: user management page"
status: done
priority: medium
created: "2026-04-26T18:53:07Z"
created_by: human
claimed_by: agent-bravo
claimed_at: "2026-04-26T18:56:56Z"
labels:
  - web
branch: null
files: []
depends_on: []
---

## Description

Build admin page at `web/src/app/admin/users/` for managing users.

### What it needs

1. **User list**: searchable table showing all users with name, email, role, created date, subscription status
2. **User detail view**: click into a user to see their full profile — subscription history, activated kits, skill downloads, reviews written
3. **Role management**: ability to change a user's role (user/admin)
4. **Kit activations per user**: show which kits a user has activated, status, timestamps (linked from the general dashboard)

### Existing code

- `web/src/db/auth-schema.ts` — `user` table with role field
- `web/src/db/schema.ts` — `kitActivations`, `skillDownloads`, `subscriptions` tables
- `web/src/app/admin/layout.tsx` — admin layout with sidebar (add Users under a new 'Users & Access' section)
- `web/src/lib/admin-auth.ts` — `requireAdmin()` helper

### Notes

- User detail should link to their kit activations and subscription
- Do NOT allow deleting users from this page — too destructive for a v1

## Work Log
### [2026-04-26T19:03:36Z] agent-alpha
Built user management page: API routes at /api/admin/users (list with kit/download counts, detail with activations/downloads/subscription, role-only PUT). Admin page with searchable user table, detail view with role toggle confirmation, subscription/activations/downloads sections.