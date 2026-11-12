# CLAUDE.md for kitstack

Guidance for working in this repository. Read this before making changes.

## What this is

KitStack is a TypeScript SDK and an MCP router for building **kits**: self-contained MCP
applications with typed tools, in-chat Views, versioned instructions, structured memory and an
optional bounded agent loop. The router exposes every kit through two static MCP tools, `kit`
and `kit_view`, so `tools/list` never changes and discovery is progressive. Kits run on a
plugin-composed host that supplies persistence, memory, instructions, AI, HTTP, triggers,
channels, an inference proxy and a scheduler.

**The north star is one governed path for every tool call.** Whether a call arrives at the hosted
router or at a customer's self-hosted `serve()`, it passes through one `dispatch` function:
resolve kit, identity, grant, policy, read/write gate, invoke, telemetry, audit. Existing MCP
servers join the same path through a data-only manifest. The goal is a platform a customer
installs without us. The sales debrief voice agent in `kits/debrief` is the reference
implementation and exercises every primitive.

Two product invariants drive the design:

1. **Metadata-only telemetry.** Prompts, completions, audio, transcripts, tool arguments and tool
   results never reach a telemetry record or an exporter. The SDK rejects them before export.
   Adding a content field to a telemetry record is a contract change, never a feature.
2. **Fail closed.** A missing grant, an unknown identity or a misconfigured auth mode denies the
   call. `KITSTACK_DEMO_MCP_AUTH=none` is loopback-only and is never a fallback.

## Source of truth documents

- **Tracking:** `.track/` is tracked in git in full since 2026-11-12, modeled on the insai repo.
  `.track/KNOWLEDGE.md` says what goes where. The repository is public, so nothing in `.track/`
  may carry a secret or a person's phone number or email (KNOWLEDGE.md, "The one rule").
- **Decisions:** `.track/adr/`, numbered, never rewritten. Read before re-deriving one. Write one
  when a decision is hard to reverse, surprising without context and the result of a real
  trade-off. Format and index in `.track/adr/README.md`.
- **Specs, plans, findings:** `.track/specs/` (intended behavior), `.track/plans/` (approved
  plans), `.track/findings/` (dated measurements, including the wrong ones).
- **Tickets and board:** `.track/tickets/` and `.track/BOARD.md`, run by the `track` CLI
  (`.track/CONVENTIONS.md`).
- **Roadmap:** `web/content/docs/roadmap.mdx`. The core steps in dependency order, what comes
  after them, and what will not be built. When code and roadmap disagree on intent, the roadmap
  wins; update it in the same change if intent changed.
- **Vision and positioning:** `README.md`, including the section on how KitStack relates to MCP
  gateways.
- **Reference implementation:** `kits/debrief/README.md`. The session state machine, guardrails,
  access model and host composition.
- **SDK contracts:** `docs/sdk/` (MCP manifests, audit export, telemetry export, container
  deployment) and `docs/storage-adapters.md`.
- **Operations:** `infra/operations/README.md`. Health, rollback, migrations, secret rotation,
  backup. Its voice section still describes ECS; the voice service now runs on the Hetzner box
  (`scripts/deploy-voice.sh`).
- **Developer docs:** `web/content/docs/`, rendered by the web app.

`CONTRIBUTING.md` says `docs/` is gitignored. It is tracked. Treat it as published material.

## Architecture rules (non-negotiable)

1. **Everything goes through dispatch.** A new transport, channel or host calls the SDK's
   `dispatch` (`packages/sdk/src/server/dispatch`). It never invokes a tool handler directly, so
   grants, the mode gate, telemetry and audit stay in one place.
2. **Tools reach capabilities through `ctx`.** Handlers receive
   `ctx = { db, identity, channel, telemetry, audit, log, connectors }`. A tool never imports a
   provider SDK, reads a secret or opens a connection itself.
3. **Every tool declares its mode.** `mode: "assist"` reads, `mode: "act"` writes or causes an
   effect outside the kit. An `act` tool requires the `kit:act` grant
   (`packages/mcp-server/src/router/authz.ts`).
4. **Infrastructure is a plugin.** Persistence, AI, voice, HTTP, triggers and connectors are
   plugins (`KitServer.use()`, the debrief plugin registry) or `Connector<Config, Client>`
   bindings. Secrets resolve at bind time from the deploy binding, never at call time from
   `process.env` inside a kit.
5. **The kit owns behavior, the host owns providers.** A kit defines tool schemas, policy,
   instructions and channel contracts. Twilio, OpenAI Realtime, libSQL and auth live in the host.
   Another host must be able to replace them without touching the kit.
6. **Tenant isolation.** Every query is scoped to an organization. Personal users work in
   `org-user-<userId>`; operators hold `kit:admin` on `org-demo`. A router token for a personal
   org is accepted only for its own user.
7. **No general agent framework.** A `defineAgent` loop is scoped to one kit's tools and one
   trigger. No cross-kit orchestration, chains or graph DSL.
8. **Migrations are forward-only.** Schema changes are additive. The debrief kit uses the
   PRAGMA-check-then-ALTER pattern; the web app uses Drizzle migrations. The SDK build validator
   rejects `DROP`.

## Tool design

A kit is judged by how well an LLM uses it, not by how many endpoints it covers.

- Tools are shaped around user tasks, not around resources or endpoints. One tool per endpoint
  repeats the problem kits exist to fix.
- Every parameter has a `.describe()`. The model chooses arguments from those descriptions.
- Write tools return structured results (`kit.result(kit.created(...))`), never `kit.text()`, so
  the next call can chain on the returned IDs.
- Check not-found before update or delete and return `kit.notFound()`, `kit.error()` or
  `kit.validationError()` with an actionable message.
- Entity IDs are `nanoid()`, never auto-increment.
- Every kit ships instructions. A kit without them gives the model no behavioral guidance.
- Verify with the tool iterator (`.claude/skills/tool-iterator-skill`) and the eval harness
  (`packages/sdk/src/eval.ts`), which compares a scenario against a CRUD baseline on round-trips,
  result tokens and task success.

The kit-builder skill (`.claude/skills/kit-builder-skill`) predates `ctx`, connectors and tool
modes. Apply the rules above where it disagrees.

## Working method

1. **Tests run with fake providers.** No test needs Twilio, OpenAI, AWS or a network.
   Time-dependent behavior uses the fake clock in `kits/debrief/test/fixtures.ts`.
2. **Passing unit tests are not a provider smoke.** A live phone call counts as verified only
   after an operator-controlled rehearsal. Say which of the two a change has.
3. **Telemetry tests assert absence.** They check that no content field is present, not only that
   metadata fields are.
4. **Reuse before build.** Search `packages/sdk` for an existing primitive before adding one to a
   kit. A capability two kits need belongs in the SDK or its own package (`packages/voice` and
   `packages/crm` started inside the debrief kit).
5. **The gate.** A change is done when `npm test`, `npm run typecheck:kits` and the touched
   workspace's typecheck pass. `npm run eval:ci` runs in the `Kit evals` workflow on every pull
   request; since at least 2026-11-07 it fails at `npm ci` on an esbuild version mismatch, so the
   eval table is missing until that is fixed.
6. **Check delegated work.** A subagent's report is a claim. Read the diff and the test output
   before calling the work done.

## Stack

| Concern       | Choice                                                                    |
| ------------- | ------------------------------------------------------------------------- |
| Monorepo      | npm workspaces (`web`, `packages/*`, `kits/debrief`); other kits are standalone packages |
| SDK           | `@kitstackco/sdk`: `defineKit`, `defineTool`, `defineView`, `defineAgent`, `serve()`, CLI |
| Router        | `@kitstackco/mcp-server` on AWS Lambda, OAuth 2.1 authorization server    |
| Authorization | `@kitstackco/authz`, relation tuples (`kit:use`, `kit:act`, `kit:admin`, ...) |
| Voice         | `@kitstackco/voice`: Twilio media streams bridged to OpenAI Realtime      |
| CRM           | `@kitstackco/crm`: provider-neutral capability, HubSpot connector         |
| Web           | Next.js 15 on OpenNext, Fumadocs for `web/content/docs`, Tailwind          |
| Database      | Turso/libSQL (platform and per-user kit DBs), Drizzle for the web app     |
| Infra         | SST v4 on AWS `eu-central-1`; the voice service on a Hetzner box via Docker Compose |
| Telemetry     | SDK event contract, OTLP/HTTP exporter, W3C trace context                 |
| Audit         | SDK `HashChainedAuditStore` with SIEM export; the router still logs JSON lines to CloudWatch |
| Tests         | Vitest in every workspace                                                 |

## Layout

```
packages/
  sdk/          # defineKit/Tool/View/Agent, dispatch, serve(), connectors, telemetry,
                # audit, eval harness, container build, CLI (init dev build deploy publish serve call)
  mcp-server/   # hosted router: handler, mcp-protocol, tool-dispatcher, platform-adapter,
                # oauth/ (incl. OIDC federation), authz, audit, app-data, db
  authz/        # tuple store: check, grant, revoke, listObjects, listSubjects
  voice/        # phone channel, Twilio Verify, Realtime bridge
  crm/          # CRM capability and HubSpot connector
kits/
  debrief/      # reference implementation: sales prebrief, call, confirmation, memory
  platform/     # Views for overview, registry, grants, audit, usage/FinOps
  fressnapf/ projects/ adint/   # earlier kits on the hosted path, own package.json each
integrations/
  hubspot/      # HubSpot private app project for the CRM connector
web/            # site, docs (content/docs), blog, /demo observability screens
infra/          # SST: secrets, storage, mcp (router), demo (voice DNS), web; operations/
scripts/        # deploy-voice.sh, run-evals.ts, seeds, typecheck-maintained-kits.mjs
.claude/skills/ # kit work: kit-builder, tool-iterator, dev-docs, frontend-design, skill-creator
                # engineering (from insai, see VENDORED.md): grilling, grill-with-docs,
                # domain-modeling, codebase-design, improve-codebase-architecture,
                # fault-injection, write-ticket, writing-for-agents, unslop
.track/         # TRACKED IN FULL: adr/ specs/ plans/ findings/ releases/ tickets/ BOARD.md
```

## Branches and releases

Two long-lived branches, modeled on the insai repo on 2026-11-12. `dev` is the integration line.
Working branches (`claude/...`, `feat/...`, `fix/...`, `t-NNNN-...`) start from it and merge back
into it. `main` holds exactly what runs on the `production` stage. Changes move from `dev` to
`main` by fast-forward only, never by a commit made on `main`:

```bash
git push origin dev:main         # promote, then deploy production from a checkout of main
```

Production deploys run by hand from a clean checkout at the tip of `origin/main`.
`npx sst deploy --stage production` ships the router, web and infra, and
`scripts/deploy-voice.sh` ships the voice service to the Hetzner box. No script enforces the
branch yet, so compare `git rev-parse HEAD` with `git rev-parse origin/main` before either
deploy. `deploy-voice.sh` only checks that the voice workspaces are clean and tags the image with
the short commit hash. Roll back with `infra/operations/rollback-stage.sh` and a known-good commit
or tag. Personal stages (`.env.<name>`) deploy from any branch. The `Kit evals` workflow runs on
every pull request and on pushes to `dev` and `main`.

Releases are three-part SemVer. The released unit today is `@kitstackco/sdk`, whose version lives
in `packages/sdk/package.json` (0.2.0, tagged `v0.2.0` on 2026-10-13). Root `package.json` reads
0.1.0 and is not a release number. The version is bumped on `dev` ahead of the release it names,
and the annotated tag goes on the `main` commit that ships it. A version is never reused. A fix
after a failed release gets the next patch number.

A fix that cannot wait for the next promotion takes the hotfix path. It is the only way a commit
reaches `main` without passing `dev` first.

1. Cut `hotfix/vX.Y.Z-<slug>` from `origin/main`. It holds only what the fix needs.
2. `git push origin hotfix/vX.Y.Z-<slug>:main` fast-forwards `main`, then deploy as above.
3. The same day, merge `origin/main` into `dev` and push `dev`. This merge commit on `dev` is
   allowed. It keeps the next `dev:main` a fast-forward.

Agents work on a working branch or on `dev`, and push `dev` only when the user asks. An agent
never pushes to `main` and never deploys `production` without the user's explicit go-ahead in
the same session.

## Commands

```bash
npm test                     # every workspace suite plus infra/operations
npm run typecheck:kits       # maintained kits against the request-scoped ctx contract
npm run eval:ci              # eval harness, promotes the baseline (runs in CI)
npm run demo:server          # debrief host on 127.0.0.1:3001
npm run dev                  # sst dev: Turso CLI, router, web
npm run dev --workspace kitstack-web    # web app on :3000
npm run db:generate          # Drizzle migrations for the web app
npm run sync:secrets         # push .env.<stage> into SST secrets
scripts/deploy-voice.sh      # build and restart the voice service on the Hetzner box
```

Commands handed to the user start with `cd <absolute path> &&`, because they paste them into
whatever terminal is open.

## Environment and secrets

Copy `.env.example` to `.env.<stage>` and push it with `./infra/sync-secrets.sh <stage>`. The
debrief host's variables are listed in `CONTRIBUTING.md`; everything has a local default except
the provider credentials a real call needs. The voice service's environment lives only in the
root-only file `/opt/kitstack/voice/voice.env` on the box and is never copied by a script.
Never put a secret value in a shell argument, log, commit message or screenshot.

Production deploys use `removal: "retain"`. Each `sst remove --stage production` has left empty
VPCs behind, and the 5-VPC limit in `eu-central-1` then blocks the next deploy. Compare
`aws ec2 describe-vpcs` with `sst state export` before a production redeploy. Deleting a VPC
needs the user's explicit approval.

## Global rules (from user)

- `psql` is not installed. Use Python for any database interaction.
- **DROP statements are forbidden** in any SQL or script. Do not generate them.
- Replies, commit messages, docs and PR descriptions follow the `my-writing-style` skill. The
  result comes first, sentences are short and whole, and numbers carry a unit and a date. No em
  dashes, no colon as a mid-sentence connector, no bold label that only restates its line, no
  marketing words.
