# Contributing and local development

This document covers running KitStack locally and the repository layout. For
what KitStack is and why it is built this way, read the [README](README.md).

## Prerequisites

- Node.js 22+
- For the SDK and the debrief kit: nothing else. Tests and the local host use
  an in-memory or file-backed libSQL database.
- For the web app and the AWS reference deployment: AWS credentials, a Turso
  account, and the secrets listed in [`.env.example`](.env.example).

## Setup

```bash
git clone <repo-url> && cd kitstack
npm install
npm test                                  # debrief kit + host, 136 tests
npm run demo:server                       # local host on 127.0.0.1:3001
npm run dev --workspace kitstack-web      # web app on :3000, open /demo
```

For the full stack with SST:

```bash
cp .env.example .env.<stage>              # fill in values
./infra/sync-secrets.sh <stage>           # push secrets to SST
npm run dev                               # sst dev: Turso CLI, router, web
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run the debrief kit and host suite with Vitest |
| `npm run demo:server` | Start the plugin-composed debrief host over HTTP |
| `npm run start:stdio --workspace @kitstackco/debrief-kit` | Same host over stdio for Claude Code or Desktop |
| `npm run typecheck --workspace @kitstackco/debrief-kit` | TypeScript check for the kit |
| `npm run publish:assets --workspace @kitstackco/debrief-kit` | Build Views and upload the shell to the assets bucket |
| `npm run dev` | `sst dev` for the full stack |
| `npm run dev:db` | Local Turso on `databases/local.db` |
| `npm run db:generate` / `npm run db:seed` | Drizzle migrations and catalog seed for the web app |
| `npm run sync:secrets` | Sync `.env.<stage>` into SST secrets |

## Environment

The debrief host reads these; all have local defaults except the provider
credentials needed for a real call.

```
PORT, HOST                              default 3001, 127.0.0.1
KITSTACK_DEMO_DB_URL                    default file-backed libSQL; set a Turso URL for remote
KITSTACK_DEMO_DB_AUTH_TOKEN
KITSTACK_DEMO_MCP_AUTH                  none | app-token | internal-signed
KITSTACK_DEMO_ADMIN_TOKEN               required for app-token and internal-signed modes
KITSTACK_DEMO_INTERNAL_SECRET           shared with the router in internal-signed mode
KITSTACK_DEMO_SCHEDULER_INTERVAL_MS     poller interval
KITSTACK_DEMO_VOICE_DOMAIN              public HTTPS/WSS host for Twilio media streams
DemoAllowedDestination                  the one E.164 number a live call may reach
TwilioAccountSid, TwilioAuthToken, TwilioFromNumber
OpenAiApiKey, OPENAI_REALTIME_MODEL, OPENAI_REALTIME_VOICE
```

`none` is loopback-only and is never a fallback: a misconfigured token mode
fails closed. The web app and router variables are listed in `.env.example`.

## Repository layout

```
packages/
  sdk/
    src/define-kit.ts, define-tool.ts, define-view.ts, define-loader.ts
    src/define-agent.ts        bounded agent loop
    src/plugins/               manifest, registry, context
    src/server/                serve(), protocol (kit + kit_view), auth adapters, view router
    src/cli/commands/          init, dev, build, deploy, publish, serve, login, call
    src/testing/               createTestKit()
  mcp-server/
    src/router/                handler, mcp-protocol, kit-handler, tool-dispatcher,
                               platform-adapter (virtual debrief kit), oauth/, audit, authz
    src/app-data/              data endpoint for View iframes
    src/db/                    registry and per-user database provisioning
  authz/                       tuple store: check, grant, revoke, listObjects, listSubjects

kits/
  debrief/
    kit.config.ts              kit identity, eight tools, three Views
    src/contracts.ts           session state machine, operation port, capability contracts
    src/agent/                 createSalesAgent() over defineAgent
    src/tools/ views/ instructions/ memory/ scheduler/ telemetry/
    src/plugins/registry/      ten plugin kinds and their telemetry
    src/adapters/              auth (three MCP modes), proxy, voice (Twilio + Realtime)
    src/channels/ triggers/    voice channel, manual and Twilio triggers
    src/transports/            server.ts, http/, mcp/stdio.ts
    src/composition/app/       concrete wiring for this repository; the dogfood e2e test
  crm/ expenses/ content-planner/ decision-journal/ projects/ adint/ fressnapf/
                               earlier kits on the hosted path; each has its own package.json

web/
  content/docs/                MDX docs the site renders
  src/app/demo/                Runtime/Registry and Usage/Observability/FinOps screens
  src/content/blog/            long-form posts

infra/                         SST: secrets, storage, mcp (router), demo (voice service), web
```

`docs/` at the repository root is gitignored working material and is not part
of the published repository.

## Testing conventions

- Every kit and host test runs with fake providers. No test needs Twilio,
  OpenAI, AWS, or a network.
- Time-dependent behavior uses the fake clock in `kits/debrief/test/fixtures.ts`.
- Passing unit tests never count as a provider smoke. A live phone call is
  recorded as verified only after an operator-controlled rehearsal.
- Telemetry tests assert the absence of content fields. Adding a prompt,
  transcript, or payload field to a telemetry record is a contract change, not
  a feature.

## Tech stack

| Layer | Tech |
|-------|------|
| SDK and host | TypeScript, Node 22, Zod, Drizzle, libSQL |
| Router | Custom MCP server (stdio + streamable HTTP), `jose` JWTs, OAuth 2.1 with PKCE |
| Voice | Twilio Calls and Media Streams, OpenAI Realtime, `ws` |
| Web | Next.js 15, React 19, Tailwind, BetterAuth, TanStack Query |
| Infra | SST v3 on AWS: Lambda (Node 22, ARM64), ECS/Fargate, ALB, DynamoDB, S3, CloudWatch |
| Analytics | PostHog |
