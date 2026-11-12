---
id: T-0081
title: "Admin: skill upload page in web/src/app/admin/"
status: done
priority: medium
created: "2026-04-26T13:10:46Z"
created_by: human
claimed_by: agent-alpha
claimed_at: "2026-04-26T18:34:15Z"
labels:
  - web
branch: null
files: []
depends_on: []
---

## Description

## Description

Build an admin page at `web/src/app/admin/skills/` for uploading and managing skills. Currently skills are seeded via `npx sst shell -- npx tsx scripts/seed-skills.ts`.

### What it needs

1. **Auth gate**: check user role — only admins can access. The `user` table has a `userRole` field
2. **Skill list**: table showing all skills with name, category, download count, s3Key status
3. **Upload form**: select a zip file, fill in metadata (name, slug, category, description, tags, etc.), submit
4. **API route** `POST /api/admin/skills`: receives multipart form data, uploads zip to `SkillAssets` S3 bucket as `skills/{slug}.zip`, upserts the skill record in Turso's `skills` table

### Existing code to reference

- `web/src/db/schema.ts` — `skills` table schema with all fields
- `scripts/seed-data.ts` — seed data showing the shape of skill records
- `scripts/seed-skills.ts` — current upload logic (zip + DB seed)
- `web/src/services/skill.service.ts` — existing skill query functions
- `web/src/services/storage.service.ts` — S3 presigned URL helper (uses `SkillAssets` bucket)
- `web/src/app/skills/page.tsx` — public skills listing page (for reference)

### S3 bucket

Skills use `SkillAssets` bucket (not `KitAssets`). The zip is uploaded to `skills/{slug}.zip`. Downloads use presigned URLs via `getDownloadUrl()` in `storage.service.ts`.


## Work Log
### [2026-04-26T18:40:34Z] agent-alpha
Built admin skills page with full CRUD. Added role field to user table, requireAdmin helper, admin layout with extensible sidebar, skills list+create+edit+delete page, API routes with S3 upload, placeholder kits page for T-0082.