---
id: T-0083
title: "CLI: build /cli/authorize web route properly (handle edge cases)"
status: done
priority: low
created: "2026-04-26T13:10:46Z"
created_by: human
claimed_by: agent-alpha
claimed_at: "2026-04-27T20:12:47Z"
labels:
  - cli
branch: null
files: []
depends_on: []
---

## Description

## Description

Harden the `/cli/authorize` web route and `/api/cli/token` API endpoint.

### Current implementation

- `web/src/app/cli/authorize/page.tsx` — client-side page, checks BetterAuth session, shows "Authorize" button
- `web/src/app/api/cli/token/route.ts` — creates a BetterAuth session in Turso with 1-year expiry, validates callback is localhost

### Edge cases to handle

1. **Callback URL validation**: currently checks `hostname === "localhost" || "127.0.0.1"`. Should also handle IPv6 `[::1]`, reject non-HTTP schemes, reject URLs with credentials
2. **Session cleanup**: old CLI sessions accumulate. Add a `userAgent: "kitstack-cli"` marker and allow revoking all CLI sessions from the web dashboard
3. **Rate limiting**: prevent spam token creation. Max 5 CLI sessions per user
4. **Error states**: handle network errors during auth, BetterAuth session expiry mid-flow, user denying authorization
5. **CSRF**: the authorize page should validate the `callback` parameter before showing the button
6. **Login redirect**: when redirecting to `/login`, preserve the full callback URL so the user returns to the authorize page after logging in — test with different auth providers (email, Google, GitHub)

### Files

- `web/src/app/cli/authorize/page.tsx`
- `web/src/app/api/cli/token/route.ts`
- `packages/sdk/src/cli/commands/login.ts` — the CLI side (2-minute timeout already implemented)


## Work Log