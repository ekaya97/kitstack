---
id: T-0087
title: "Admin: author management page"
status: done
priority: medium
created: "2026-04-26T18:53:16Z"
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

Build admin page at `web/src/app/admin/authors/` for managing author profiles.

### What it needs

1. **Author list**: table showing all authors with handle, display name, verified status, linked user (if any)
2. **Create/edit author**: form to create or update author profiles (handle, display name, bio, avatar URL, website, location)
3. **Verify toggle**: mark authors as verified
4. **Link to user**: associate an author profile with a user account

### Existing code

- `web/src/db/schema.ts` — `authors` table (id, userId, handle, displayName, bio, avatarUrl, verified, website, location)
- `web/src/app/admin/layout.tsx` — add Authors under 'Content' section in sidebar

### Notes

- Third-party authors are on the roadmap — this page will be important when skill/kit marketplace opens up
- Author handle must be unique — validate on create

## Work Log
### [2026-04-26T19:03:36Z] agent-alpha
Built author management page: API routes at /api/admin/authors (CRUD). Admin page with author table (handle, verified status, linked user), create/edit form (profile, linking, verification toggle), delete modal.