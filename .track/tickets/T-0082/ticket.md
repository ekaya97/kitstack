---
id: T-0082
title: "Admin: kit management page in web/src/app/admin/"
status: done
priority: medium
created: "2026-04-26T13:10:46Z"
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

## Description

Build an admin page at `web/src/app/admin/kits/` for managing kit metadata. This is NOT about deploying kits (that's `kitstack deploy`) — it's about managing the marketing/listing data shown on the web app.

### What it needs

1. **Auth gate**: admin role check
2. **Kit list**: table of all kits from `kits` table with name, category, status, subscriber count
3. **Edit form**: update kit metadata (name, description, tagline, category, pricing, status)
4. **Kit activation management**: view which users have activated which kits (from `kit_activations` table)

### Existing code

- `web/src/db/schema.ts` — `kits` table schema, `kitActivations` table
- `scripts/seed-data.ts` — `seedKits` array showing kit record shape
- `web/src/app/kits/` — public kit listing pages

### Notes

- Kit metadata (marketing) is in the `kits` table in Turso (managed by web app)
- Kit registry (tools/views for MCP) is in the `kit_registry` / `kit_views` tables (managed by `kitstack deploy`)
- These are separate concerns — the admin page manages the former, not the latter


## Work Log
### [2026-04-26T19:03:35Z] agent-alpha
Built kit management page: API routes (GET/POST/PUT/DELETE) at /api/admin/kits, full admin page with list view (table with status chips), create/edit form (basic info, pricing, MCP tools/apps, DB schema), delete modal.