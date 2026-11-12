---
id: T-0091
title: "Sortable columns on public skills and kits pages"
status: done
priority: low
created: "2026-04-26T18:53:55Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - web
branch: null
files: []
depends_on: []
---

## Description

Add sort-by capability to the public skills and kits listing pages so users can sort by popularity.

### What it needs

**Skills page** (`web/src/app/skills/page.tsx`)
- Sort by: downloads (most popular), name (A-Z), newest
- Default: most downloads

**Kits page** (`web/src/app/kits/page.tsx`)
- Sort by: activations (most popular), name (A-Z), newest, savings (highest)
- Default: most activations

### Implementation

- Add a sort dropdown/pill next to the existing category filter bar
- Sorting is client-side (data is already fully fetched)
- API routes may need to return the relevant counts (`downloadCount`, `subscriberCount`) if not already included in the card data

### Existing code

- `web/src/services/transformers.ts` — `toSkillCard` already includes `downloads`, `toKitCard` includes `subscribers`
- Both pages already have a filter bar with category chips — add sort control alongside

## Work Log
### [2026-07-20T19:14:53Z] claude
Closing: public marketplace listing-page nicety, obsolete after pivot to company-internal tool.