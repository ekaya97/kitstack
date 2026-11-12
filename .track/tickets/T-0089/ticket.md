---
id: T-0089
title: "Admin: review moderation page"
status: done
priority: medium
created: "2026-04-26T18:53:34Z"
created_by: human
claimed_by: agent-bravo
claimed_at: "2026-04-26T18:56:57Z"
labels:
  - web
branch: null
files: []
depends_on: []
---

## Description

Build admin page at `web/src/app/admin/reviews/` for moderating user reviews.

### What it needs

1. **Review list**: table of all reviews across skills and kits — user, target (skill/kit), rating, text preview, verified status, date
2. **Filters**: filter by target type (skill/kit), by rating, by verified status
3. **Moderation actions**: toggle verified status, delete review
4. **Review detail**: expand to see full review text, helpful vote count
5. **Link context**: link to the skill/kit being reviewed, link to the user who wrote it

### Existing code

- `web/src/db/schema.ts` — `reviews` table (id, targetType, targetSlug, userId, userName, userRole, rating, text, verified), `reviewHelpful` table
- `web/src/app/admin/layout.tsx` — add Reviews under a 'Moderation' section in sidebar

### Notes

- Reviews use a unique index on (userId, targetType, targetSlug) — one review per user per target
- Helpful votes are tracked separately in `review_helpful` table

## Work Log
### [2026-04-26T19:03:36Z] agent-alpha
Built review moderation page: API routes at /api/admin/reviews (list with helpful counts + filters, verify toggle, delete with cascade). Admin page with type/verified filter chips, expandable review rows, verify/unverify toggle, delete modal.