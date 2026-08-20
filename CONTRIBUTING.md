# Contributing / Local Development

This document covers running KitStack locally and the repository layout. For what
KitStack is and why it's built the way it is, see the [README](README.md).

## Prerequisites

- Node.js 22+
- AWS credentials configured (for the SST reference deployment)
- Turso account + database (or any libSQL-compatible endpoint)

## Setup

```bash
git clone <repo-url> && cd kitstack
npm install
cp .env.example .env    # fill in values
npm run db:migrate      # apply schema
npm run db:seed         # seed catalog data
npm run dev             # starts SST + Next.js
```

## Environment Variables

```
# Database
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=...

# Auth
BETTER_AUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Payments
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_STORE_ID=...
LEMONSQUEEZY_WEBHOOK_SECRET=...

# MCP
MCP_JWT_SECRET=...
MCP_SERVER_URL=https://mcp.your-domain.example
TURSO_PLATFORM_API_TOKEN=...
TURSO_ORG_NAME=...

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=...

# App
SITE_URL=http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | SST + Next.js dev server |
| `npm run build` | Production build |
| `npm test` | Run all tests (Vitest) |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:push` | Push schema to Turso |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed catalog data |
| `npm run upload` | Upload skill assets to S3 |

## Repository Layout

```
web/
  src/
    app/                 Next.js pages and API routes
    components/          React components
    db/                  Drizzle schema + migrations
    hooks/               TanStack Query hooks
    lib/                 Auth, DB client, analytics, utilities
    services/            Business logic (kit lifecycle, subscriptions, payments)
    stores/              Zustand stores

packages/
  sdk/                   @kitstackco/sdk — defineKit / defineTool / defineView,
                         CLI, build + deploy pipeline, serve() self-host runtime
  mcp-server/            MCP router (onion-pattern dispatch, entitlements)
    src/router/          Protocol handling, kit tool dispatch
    src/framework/       Shared MCP framework (tool defs, DB provisioning)
    src/app-data/        AppData Lambda for interactive view iframes
  mcp-apps/              Vite-built interactive UI components (iframes)
  authz/                 Authorization primitives

kits/                    Reference kits (crm, expenses, content-planner, …)
skills/                  Downloadable skill packages
infra/                   SST infrastructure (storage, web, mcp)
docs/                    Specs and research
```

## Full Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React 19, Tailwind, HeroUI, Framer Motion |
| State | TanStack Query 5, Zustand |
| Auth | BetterAuth (Drizzle adapter) |
| Database | Turso (SQLite), DynamoDB |
| ORM | Drizzle |
| Validation | Zod |
| Payments | Lemon Squeezy |
| Infra | SST v3, AWS Lambda (Node 22, ARM64) |
| MCP | Custom onion-pattern server (stdio + HTTP) |
| Analytics | PostHog |
| Blog | MDX via next-mdx-remote |
