---
id: T-0102
title: "First 50 signups get pro subscription by default"
status: done
priority: high
created: "2026-05-03T16:21:06Z"
created_by: human
claimed_by: agent-alpha
claimed_at: "2026-05-06T10:35:02Z"
labels:
  - auth
  - subscriptions
  - growth
branch: null
files: []
depends_on: []
---

## Description

Give the first 50 users who sign up an automatic pro subscription — no payment required.

## Current state
- BetterAuth handles auth (web/src/lib/auth.ts) with email/password + Google/GitHub OAuth.
- Signup happens client-side via authClient.signUp.email() in web/src/app/(auth)/login/page.tsx:88-99.
- Subscriptions table (web/src/db/schema.ts:71-82) has plan enum: "starter" | "pro", status enum:
  "active" | "cancelled" | "expired", and a lemonSqueezySubscriptionId field (unused for now).
- createSubscription(userId, plan) in web/src/services/subscription.service.ts:19-44 already handles
  creating a subscription with a 30-day period — currently mocked billing (no real payment).
- The admin dashboard already counts total users via db.select({ count: count() }).from(user).

## Implementation approach
Hook into the BetterAuth flow. BetterAuth supports hooks/plugins — add a post-signup hook or
databaseHooks.user.create.after callback in the auth config (web/src/lib/auth.ts) that:

1. Counts total users in the user table.
2. If count <= 50, calls createSubscription(userId, "pro") to assign a free pro subscription.
3. Fires a tracking event (trackProSubscriptionAssigned or similar) via web/src/lib/analytics-server.ts.

Alternative: create a server-side API endpoint /api/auth/post-signup that the login page calls after
successful signup. This is simpler but less reliable (client could skip the call).

## Key files
- web/src/lib/auth.ts (BetterAuth config — add hook here)
- web/src/db/auth-schema.ts:4-20 (user table)
- web/src/db/schema.ts:71-82 (subscriptions table)
- web/src/services/subscription.service.ts:19-44 (createSubscription)
- web/src/app/(auth)/login/page.tsx:88-99 (signup flow)
- web/src/app/api/subscription/route.ts (subscription API)
- web/src/lib/analytics-server.ts (tracking)

## Edge cases
- OAuth signups (Google/GitHub) must also trigger the hook, not just email signups.
- Race condition: two users signing up simultaneously could both see count=50. Use a transaction
  or accept minor overcount (51st user gets pro is fine).
- Ensure idempotency: if user already has a subscription, createSubscription already returns early.

## Work Log
### [2026-05-06T10:36:15Z] agent-alpha
Committed 014086b: databaseHooks.user.create.after in auth.ts grants pro to first 50, analytics event added
### [2026-07-20T19:14:53Z] claude
Closing as done: already implemented — early-adopter hook in web/src/lib/auth.ts:20-39 grants first 50 signups a pro subscription.