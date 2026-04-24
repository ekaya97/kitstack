# KitStack

Two-tier AI tool platform: free skills (downloadable .zip) and subscription kits (persistent MCP apps). One connector, all your tools.

## What It Does

**Skills** are free, downloadable instruction packs. Each is a .zip containing behavioral prompts, reference docs, templates, and examples. Users drop them into Claude, ChatGPT, or Gemini. No account needed, no server cost.

**Kits** are full applications that run through MCP. Each kit gets its own per-user database, exposes tools the LLM can call, and renders interactive UI (Kanban boards, tables, forms) directly in the chat. Data persists across sessions. All kits are available through a single MCP connector URL.

The upgrade path is natural: a user downloads the free Expense Categorizer skill, gets value, then upgrades to the Expense Kit for persistence, dashboards, and tax prep automation.

## Architecture

```
Next.js 15 (marketing + dashboard)
  |
  +-- BetterAuth (email/password, Google, GitHub)
  +-- Turso SQLite (subscriptions, activations, catalog)
  +-- Lemon Squeezy (payments)
  +-- PostHog (analytics)
  |
SST v3 on AWS
  |
  +-- McpRouter Lambda ─── MCP protocol, OAuth, dispatch
  |     |
  |     +-- kit() tool ─── single static tool, onion pattern
  |     |                   (see packages/mcp-server/README.md)
  |     |
  |     +-- Kit Lambdas ─── one per kit (crm, expense, meeting, outreach)
  |           |
  |           +-- Per-user Turso databases (provisioned on activation)
  |
  +-- AppData Lambda ─── serves kit data to MCP app iframes
  +-- DynamoDB ─── kit registry, user entitlements, OAuth state
  +-- S3 ─── skill .zip downloads
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React 19, Tailwind, HeroUI, Framer Motion |
| State | TanStack Query 5, Zustand |
| Auth | BetterAuth (Drizzle adapter) |
| Database | Turso (SQLite), DynamoDB |
| ORM | Drizzle |
| Payments | Lemon Squeezy |
| Infra | SST v3, AWS Lambda (Node 22, ARM64) |
| MCP | Custom server with onion-pattern tool discovery |
| Analytics | PostHog |
| Blog | MDX via next-mdx-remote |

## Project Structure

```
src/
  app/                 Next.js pages and API routes
  components/          React components
  db/                  Drizzle schema + migrations
  hooks/               TanStack Query hooks
  lib/                 Auth, DB client, analytics, utilities
  services/            Business logic (kit lifecycle, subscriptions, payments)
  stores/              Zustand stores

packages/
  mcp-server/          MCP server (router, kits, framework)
    src/router/        Protocol handling, kit tool dispatch
    src/kits/          Kit implementations (crm, expense, meeting, outreach)
    src/framework/     Shared MCP framework (tool defs, DB provisioning)
    src/app-data/      AppData Lambda for MCP app iframes
  mcp-apps/            Vite-built interactive UI components (iframes)

skills/                Free downloadable skill packages
infra/                 SST infrastructure (storage, web, mcp)
docs/                  Specs and research
```

## Getting Started

### Prerequisites

- Node.js 22+
- AWS credentials configured (for SST)
- Turso account + database

### Setup

```bash
git clone <repo-url> && cd kitstack
npm install
cp .env.example .env   # fill in values
npm run db:migrate      # apply schema
npm run db:seed         # seed catalog data
npm run dev             # starts SST + Next.js
```

### Environment Variables

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
MCP_SERVER_URL=https://mcp.kitstack.co
TURSO_PLATFORM_API_TOKEN=...
TURSO_ORG_NAME=...

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=...

# App
SITE_URL=http://localhost:3000
```

### Scripts

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

## MCP Server

The MCP server exposes a single static tool called `kit` that uses an onion pattern for progressive discovery:

```
kit()                          list activated kits
kit(id="crm")                  show actions in a kit
kit(id="crm", cmd="list")      describe an action's parameters
kit(id="crm", cmd="list", params={})   run it
```

`tools/list` always returns exactly one tool. Kit activation and deactivation are reflected dynamically through `kit()` responses, with no protocol-level notifications needed.

See [packages/mcp-server/README.md](packages/mcp-server/README.md) for the full architecture doc.

## Current Kits

| Kit | What it replaces | Actions |
|-----|-----------------|---------|
| CRM | HubSpot / Pipedrive | Contacts, deals, pipeline, proposals, export |
| Expense & Tax Prep | Expensify / Taxfix | Expense logging, categorization, tax summaries |
| Meeting Action Tracker | Fellow / Notion | Action extraction, assignment, follow-up |
| Cold Outreach | Lemlist / Apollo | Sequences, personalization, tracking |

## Current Skills

Client Proposal, Cold Email Sequence, Contract Red Flags, Expense Categorizer, LinkedIn Content, Meeting Action Extractor.

Free to download at [kitstack.co/skills](https://kitstack.co/skills).
