---
id: T-0101
title: "App previews: fetch from S3 instead of repo"
status: done
priority: high
created: "2026-05-03T16:20:52Z"
created_by: human
claimed_by: agent-alpha
claimed_at: "2026-05-06T07:39:41Z"
labels:
  - web
  - infra
  - s3
branch: null
files: []
depends_on: []
---

## Description

App preview images/HTML are currently expected under web/public/app-previews/ (empty dir with .gitkeep).
The AppPreviewTabs component (web/src/components/shared/app-preview-tabs.tsx) hardcodes paths like
/app-previews/src/{kit-id}/{view-slug}/index.html and renders them in iframes on the kit detail page
(web/src/app/kits/[slug]/page.tsx:267).

Deployed kits already upload view bundles + shell.html to S3 under apps/kits/{kitId}/ via
packages/sdk/src/deploy/upload.ts. The KitAssets bucket (infra/storage.ts) is fronted by CloudFront
at cdn.kitstack.co.

## Goal
After a kit is deployed, generate or reference standalone preview HTML for each view and serve them
from S3/CDN instead of bundling them in the repo.

## Implementation notes
- The build system (packages/sdk/src/build.ts) already produces view JS bundles + shell.html.
  A preview could be a self-contained HTML that embeds the shell + view module with sample data.
- Upload previews to S3 at e.g. apps/kits/{kitId}/previews/{view-slug}.html during deploy.
- Store the preview S3 key in the kit_views table (packages/mcp-server/src/db/schema.ts:22-32)
  alongside the existing shell_s3_key column — add a preview_s3_key column.
- Seed the preview key during registry seeding (packages/sdk/src/deploy/seed-registry.ts).
- Update AppPreviewTabs to fetch preview URLs from an API or directly from CDN
  (cdn.kitstack.co/apps/kits/{kitId}/previews/{view-slug}.html).
- Remove the hardcoded kitPreviews map and the empty web/public/app-previews/ directory.

## Key files
- web/src/components/shared/app-preview-tabs.tsx (hardcoded paths, iframe rendering)
- web/src/app/kits/[slug]/page.tsx:267 (consumer)
- packages/sdk/src/deploy/upload.ts (S3 upload logic)
- packages/sdk/src/build.ts (build artifacts)
- packages/sdk/src/deploy/seed-registry.ts (registry seeding)
- packages/mcp-server/src/db/schema.ts (kit_views table)
- infra/storage.ts (KitAssets bucket + CDN)

## Work Log
### [2026-05-06T10:33:25Z] agent-alpha
Committed dc972d8: preview template, build pipeline, S3 upload, DB schema, seed-registry, deploy script, AppPreviewTabs, kit detail page — all wired end-to-end
### [2026-07-20T19:14:53Z] claude
Closing: marketplace kit-detail preview feature. Pivot to company-internal MCP tool (docs/company-pivot-plan.md) makes the public marketplace surface obsolete.