---
id: T-0103
title: "Remove prices from web — make everything free"
status: done
priority: high
created: "2026-05-03T16:21:19Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - web
  - pricing
  - launch
branch: null
files: []
depends_on: []
---

## Description

Strip all pricing from the marketing site. Everything should be presented as free — no tiers,
no euro amounts, no SaaS comparison savings math.

## Where prices appear

### Pricing page
- web/src/app/pricing/pricing-client.tsx — the entire page: Free (€0), Starter (€5/mo),
  Pro (€19/mo), Team (custom). Yearly toggle, SaaS comparison section with per-kit savings.
  This page needs a full rewrite or removal.

### Home page
- web/src/app/page.tsx:62 — "Kits: €5/mo Starter"
- web/src/app/page.tsx:187 — "TIER 2 · €5/MO STARTER"
- web/src/app/page.tsx:199 — "Replaces €50–200/mo of SaaS"
- web/src/app/page.tsx:264-269 — dynamic SaaS savings calculation
- web/src/app/page.tsx:287 — per-kit €X/mo savings
- web/src/app/page.tsx:302 — "€5/mo" summary

### Kits browse page
- web/src/app/kits/page.tsx:52 — "€5/MO STARTER · ALL INCLUDED"
- web/src/app/kits/page.tsx:79 — "Start · €5/mo →" CTA
- web/src/app/kits/page.tsx:137 — per-kit savings

### Kit detail page
- web/src/app/kits/[slug]/page.tsx:89 — "€5/mo Starter unlocks"
- web/src/app/kits/[slug]/page.tsx:131 — "saves €X/mo"

### Kit activation card
- web/src/components/shared/kit-activate-card.tsx:111 — "€5" price
- web/src/components/shared/kit-activate-card.tsx:114 — "Starter plan · unlocks every kit"
- web/src/components/shared/kit-activate-card.tsx:132-137 — subscribe to "starter" plan

### Data layer
- web/src/db/seed-data.ts — savingsPerMonth values per kit (CRM €44, Expense €32, Outreach €66, Meeting €36)
- web/src/db/schema.ts:53 — savingsPerMonth column
- web/src/services/transformers.ts:25,74 — replacesValue mapping

## Approach
- Remove or simplify the pricing page — could become a simple "everything is free" page or redirect.
- Strip €X/mo references from home, kits, and kit detail pages.
- Change kit-activate-card CTA from "Subscribe €5/mo" to "Activate" or "Get started — free".
- Keep the subscription infrastructure (table, service, API) intact for future monetization,
  but the UI should not surface prices.
- savingsPerMonth data can stay in the DB but should not be rendered in the UI.

## Work Log
### [2026-07-20T19:14:54Z] claude
Closing: pricing/marketing site changes are obsolete after pivot to company-internal MCP tool. WS4 re-theme will restructure the web surface.