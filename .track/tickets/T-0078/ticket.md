---
id: T-0078
title: "Deploy: build + deploy remaining kits (outreach, expense, meeting)"
status: done
priority: medium
created: "2026-04-26T13:10:45Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - deployment
branch: null
files: []
depends_on: []
---

## Description

## Description

Deploy the remaining 3 kits (outreach, expense, meeting) to production using the same pipeline as CRM. Depends on T-0077 being completed first (Lambda zip fix).

### Kit locations and IDs

| Kit | Directory | Kit ID | Tools | Views |
|-----|-----------|--------|-------|-------|
| Outreach | `kits/outreach/` | `cold-outreach` | 11 | 3 |
| Expense | `kits/expense/` | `expense-tax-prep` | 7 | 4 |
| Meeting | `kits/meeting/` | `meeting-action-tracker` | 5 | 3 |

Each kit has: `kit.config.ts`, `handler.ts`, `build.ts`, `deploy.ts`, `src/schema.ts`, `src/tools/`, `src/views/`

### Steps per kit

```bash
npx tsx kits/{kit}/build.ts
npx sst shell -- npx tsx kits/{kit}/deploy.ts
```

### Notes

- All kits use `migrationSql` (not `migrationsDir`) — they haven't been migrated to drizzle-kit yet
- Some kits still import from `deprecated/` handler paths — verify `kit.config.ts` and `handler.ts` point to the right files
- View imports may use `@shared/use-kit` instead of `../../sdk-view` — check and fix like CRM
- Upload platform assets once (they're shared): `npx sst shell -- npx tsx scripts/upload-platform-assets.ts`


## Work Log
### [2026-07-20T19:14:53Z] claude
Closing: outreach/expense/meeting catalog kits are marketplace content. Stack is deleted from AWS; pivot focuses on the freelancer-search kit for the company engagement.