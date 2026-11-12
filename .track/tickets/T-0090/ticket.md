---
id: T-0090
title: "PostHog: wire up all key user actions"
status: done
priority: high
created: "2026-04-26T18:53:45Z"
created_by: human
claimed_by: agent-bravo
claimed_at: "2026-04-26T18:57:12Z"
labels:
  - web
  - analytics
branch: null
files: []
depends_on: []
---

## Description

Complete PostHog instrumentation for all key user actions. Some tracking exists (`posthog-server.ts`, `posthog-provider.tsx`) but coverage is incomplete.

### Actions to track

**Skills**
- `skill_downloaded` — slug, category, user (if logged in)
- `skill_page_viewed` — slug

**Kits**
- `kit_activated` — slug, category, user
- `kit_deactivated` — slug, user
- `kit_deleted` — slug, user
- `kit_page_viewed` — slug

**Subscriptions**
- `subscription_started` — plan, user
- `subscription_cancelled` — plan, user

**Auth**
- `user_signed_up` — provider (email/google/github)
- `user_signed_in` — provider

**Reviews**
- `review_submitted` — targetType, targetSlug, rating

**MCP**
- `mcp_connection_checked` — connected (bool)

### Existing code

- `web/src/app/posthog-provider.tsx` — client-side PostHog provider (already wraps the app)
- `web/src/lib/posthog-server.ts` — server-side PostHog client
- `web/src/app/providers.tsx` — app providers setup

### Notes

- Use server-side tracking for mutations (downloads, activations, subscriptions) for reliability
- Use client-side tracking for page views
- Ensure user identification is consistent (use BetterAuth user ID as distinct_id)

## Work Log