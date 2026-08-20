# KitStack

> **A framework for building token-efficient MCP tooling across your enterprise systems.**
> Connect your CRM, ERP, ticketing, and internal services as composable **kits** — exposed to any LLM through a single MCP router that you own and run.

[![Node 22+](https://img.shields.io/badge/node-22%2B-3fb950)](https://nodejs.org)
[![Protocol: MCP](https://img.shields.io/badge/protocol-MCP-4c6ef5)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org)

---

## Why KitStack

The expensive part of an enterprise agent isn't picking a tool — it's the **agent loop**.
Over a long task, every tool result stays in the conversation and is re-sent on every
following turn, and a CRUD-shaped surface forces the agent to make many round-trips and
pull raw records into context to reason over.

Point an agent at your systems the usual way — auto-generate one MCP tool per API
endpoint — and it inherits all of that:

- **Raw results compound.** A `list_deals` call returns dozens of full records; the model
  aggregates them itself, and those records then weigh on *every* later turn.
- **CRUD forces round-trips.** list → get → filter → join-by-hand; each hop is another
  call and another raw payload left in history.
- **The model becomes the query engine.** Work that belongs in a `GROUP BY` or a join
  happens in the context window instead.

KitStack's SDK is built to design the surface the other way: **workflow-level actions with
curated results**, so the loop stays cheap however long the task runs.

---

## Design tools for the agent, not the API

A KitStack tool is `defineTool({ args, handler })`, where the handler is arbitrary
server-side code over arbitrary context — a database, an API client, or both. So you shape
each action around what the agent is trying to *do*, and do the heavy lifting server-side:

- **Compose server-side** — `GROUP BY`, joins, and multi-step logic run in the handler;
  the model never sees raw rows.
- **Return decisions, not records** — a curated summary plus the structured IDs to chain
  on, not dozens of 40-field objects.
- **Collapse round-trips** — one action replaces a list → get → filter → join chain.

It shows up in the loop. For a routine "pipeline overview + who to follow up with" against
the CRM kit:

| | Round-trips | Result footprint | Aggregation / join by |
|---|---|---|---|
| 1:1 CRUD / OpenAPI | several | tens of thousands of raw tokens | the model, in-context |
| KitStack workflow tools | one or two | a few hundred curated tokens | the handler |

Because results persist in the conversation and are re-sent each turn, that gap isn't paid
once — it compounds across the whole task. Over a long session, curated actions keep the
loop cheap by roughly an order of magnitude while a raw-CRUD surface balloons.

> **Discovery stays clean, too.** `tools/list` never grows: a single `kit` tool
> progressively discloses kits and actions, so activating one never fires
> `tools/list_changed`. Lazy discovery is common now — KitStack just gets it for free,
> without protocol churn. See [packages/mcp-server/README.md](packages/mcp-server/README.md)
> for the mechanics, or [Five Hard Problems in MCP](web/src/content/blog/mcp-shortcomings-and-how-kits-fix-them.mdx)
> for the full argument.

---

## Build a connector in ~30 lines

A **kit** is a self-contained connector to one system. It bundles a database schema,
typed tools, optional interactive views, and the natural-language triggers/instructions
that tell the LLM when and how to use it. The `@kitstackco/sdk` surface is deliberately
small — most of a kit is just `defineKit` + a folder of `defineTool`s.

```ts
// kit.config.ts
import { defineKit } from "@kitstackco/sdk";
import * as schema from "./src/schema";
import { instructions } from "./src/instructions";
import { addContact } from "./src/tools/add-contact";
import { listDeals } from "./src/tools/list-deals";
import pipelineView from "./src/views/pipeline";

export default defineKit({
  id: "crm",
  name: "CRM",
  description: "Contacts, deals, and pipeline backed by your system of record",
  schema,
  migrationsDir: "./migrations",
  instructions,
  triggers: ["crm", "contact", "deal", "pipeline", "lead"],
  tools: [addContact, listDeals],
  views: [pipelineView],
});
```

```ts
// src/tools/add-contact.ts
import { z } from "zod";
import { defineTool } from "@kitstackco/sdk";

export const addContact = defineTool({
  name: "add_contact",
  description: "Create a contact and return its ID for follow-up actions",
  args: z.object({
    name: z.string().describe("Full name"),
    email: z.string().email().optional().describe("Work email"),
    company: z.string().optional().describe("Account name"),
  }),
  handler: async (db, args) => {
    // `db` is a typed Drizzle handle, injected per request.
    // Return structured IDs so the LLM can chain into the next action.
    const id = await insertContact(db, args);
    return { id, name: args.name };
  },
});
```

- **Type-safe end to end** — Zod-described args become the LLM-facing parameter schema and the handler's input type.
- **Data handle injected** — each tool receives a scoped Drizzle client; no connection wiring in kit code.
- **Structured results** — write tools return IDs so multi-step workflows chain cleanly.
- **Views render in-chat** — tables, boards, and forms display as interactive UI inside the conversation.

→ Full walkthrough: [Getting Started](web/content/docs/getting-started.mdx) ·
concepts for [Kits](web/content/docs/concepts/kits.mdx),
[Tools](web/content/docs/concepts/tools.mdx), and
[Views](web/content/docs/concepts/views.mdx) ·
API reference for [`defineKit()`](web/content/docs/api/define-kit.mdx) and
[`defineTool()`](web/content/docs/api/define-tool.mdx).

---

## Own your router — self-hosted

Each enterprise runs **its own** KitStack router: your data, your network, your identity
provider. The same `serve()` runtime powers local dev, production, and self-host, so
there's no separate deployment path to maintain.

```ts
// server.ts
import { serve } from "@kitstackco/sdk/server";
import crm from "./kits/crm/kit.config";
import erp from "./kits/erp/kit.config";

serve({
  kits: [crm, erp],
  databases: {
    crm: { url: process.env.CRM_DB_URL! },
    erp: { url: process.env.ERP_DB_URL! },
  },
  transport: "http",
  port: 3001,
  // auth: oauth({ ... })   // plug in your own IdP; defaults to none() for local dev
});
```

Run it as a single Node process, a container, or serverless functions — the routing,
dispatch, and view-serving code is identical across all three.

→ [How to Self-Host a Kit](web/content/docs/coming-soon/self-hosting.mdx),
[Authentication](web/content/docs/coming-soon/authentication.mdx), and the
[`kitstack serve`](web/content/docs/cli/serve.mdx) CLI reference.

---

## Architecture

```
   LLM client            ┌────────────────────────────────────┐
  (Claude, etc.)  ──────▶ │  kit  — one static MCP tool         │
                         │  onion-pattern dispatch + auth      │
                         └─────────────────┬──────────────────┘
                                           │  resolve id + cmd, check entitlement
                         ┌─────────────────▼──────────────────┐
                         │  Kit registry                        │
                         └──────┬───────────┬───────────┬──────┘
                          ┌─────▼────┐  ┌───▼────┐  ┌───▼────┐
                          │  CRM kit │  │ ERP kit│  │  …     │   kits (SDK)
                          └─────┬────┘  └───┬────┘  └───┬────┘
                          ┌─────▼────┐  ┌───▼────┐  ┌───▼────┐
                          │   DB     │  │  DB    │  │  DB    │   per-kit SQLite / libSQL
                          └──────────┘  └────────┘  └────────┘

  Interactive kit views render in-chat through the AppData surface (sandboxed iframes).
```

The **reference deployment** is SST v3 on AWS — the MCP router and each kit as Lambdas
(Node 22, ARM64), a DynamoDB registry + entitlements, and S3 for assets. None of that is
load-bearing: the router is the same `serve()` code you can run anywhere. See
[Adapting to your environment](#adapting-to-your-environment).

| Layer | Tech |
|-------|------|
| MCP runtime | Custom onion-pattern server (stdio + HTTP) |
| SDK | `@kitstackco/sdk` — `defineKit` / `defineTool` / `defineView` |
| Data | Turso / libSQL (SQLite), Drizzle ORM |
| Validation | Zod |
| Auth | Pluggable adapters — `none`, OAuth, custom IdP |
| Reference infra | SST v3, AWS Lambda, DynamoDB, S3 |

---

## Adapting to your environment

KitStack ships with opinionated defaults so it runs out of the box — but the pieces an
enterprise cares most about are **configuration, not assumptions**. The four you're most
likely to change:

| Concern | Default today | Swap point / direction |
|---------|---------------|------------------------|
| **Authn / authz** | Single-user kit entitlement; deploy authenticated by CLI session | Pluggable auth adapters already support OAuth / custom IdP. Admin-gated deploy and organization/team RBAC are in active development. |
| **Compute** | AWS Lambda per kit via SST | `serve()` runs anywhere Node runs — container, VM, or your own FaaS. No AWS lock-in in the runtime. |
| **Data** | One SQLite (Turso / libSQL) database per user, per kit | Point `DbConfig` at shared or org-scoped databases today; first-class org-keyed provisioning is on the roadmap. |
| **Scheduling** | Request-driven only (no background work) | A `defineJob` + cron capability (scrapers, digests, re-embedding) is in active development, landing in the SDK + infra. |

The self-host runtime and auth adapters already exist. Org-scoping and scheduling are the
current build focus.

→ [Authentication](web/content/docs/coming-soon/authentication.mdx) ·
[Authorization](web/content/docs/coming-soon/authorization.mdx) ·
[Roadmap](web/content/docs/roadmap.mdx).

---

## Example kits

The kits in [`kits/`](kits/) double as reference implementations of the SDK — read one
end to end to see the whole pattern, or replace them with connectors to your own systems.

| Kit | Connects | Example actions |
|-----|----------|-----------------|
| **CRM** | Contact & pipeline system | contacts, deals, pipeline, proposals, export |
| **Finance** | Expense & tax data | expense logging, VAT handling (SKR03), P&L, reporting |
| **Meetings** | Notes & action items | action extraction, assignment, follow-up |
| **Outreach** | Sequencing / engagement | sequences, personalization, tracking |

---

## Documentation

Full, in-depth documentation lives in [`web/content/docs/`](web/content/docs/) — the MDX
source the docs site renders when deployed.

**Start here**
- [Getting Started](web/content/docs/getting-started.mdx) — build and connect your first kit in ~5 minutes
- Concepts — [Kits](web/content/docs/concepts/kits.mdx) · [Tools](web/content/docs/concepts/tools.mdx) · [Views](web/content/docs/concepts/views.mdx) · [Database](web/content/docs/concepts/database.mdx) · [Migrations](web/content/docs/concepts/migrations.mdx)

**Build**
- Guides — [Defining Tools](web/content/docs/guides/defining-tools.mdx) · [Defining Views](web/content/docs/guides/defining-views.mdx) · [Testing](web/content/docs/guides/testing.mdx) · [Building & Deploying](web/content/docs/guides/deploying.mdx)
- API reference — [`defineKit()`](web/content/docs/api/define-kit.mdx) · [`defineTool()`](web/content/docs/api/define-tool.mdx) · [`defineView()`](web/content/docs/api/define-view.mdx) · [`defineLoader()`](web/content/docs/api/define-loader.mdx) · [kit helpers](web/content/docs/api/kit-helpers.mdx) · [`createTestKit()`](web/content/docs/api/create-test-kit.mdx) · [Errors](web/content/docs/api/errors.mdx)
- CLI — [`init`](web/content/docs/cli/init.mdx) · [`dev`](web/content/docs/cli/dev.mdx) · [`build`](web/content/docs/cli/build.mdx) · [`deploy`](web/content/docs/cli/deploy.mdx) · [`serve`](web/content/docs/cli/serve.mdx) · [`login`](web/content/docs/cli/login.mdx) · [`call`](web/content/docs/cli/call.mdx)

**Run it yourself**
- [Self-Hosting a Kit](web/content/docs/coming-soon/self-hosting.mdx) · [Authentication](web/content/docs/coming-soon/authentication.mdx) · [Authorization](web/content/docs/coming-soon/authorization.mdx) · [Roadmap](web/content/docs/roadmap.mdx)

**Deep dives**
- [Five Hard Problems in MCP (and How We Solve Them)](web/src/content/blog/mcp-shortcomings-and-how-kits-fix-them.mdx)
- [How Kits Work](web/src/content/blog/how-kits-work.mdx)
- [The onion pattern internals](packages/mcp-server/README.md) · [Local development & repo layout](CONTRIBUTING.md)

---

## License

[KitStack Community License 1.0](LICENSE) — source-available. Free for
noncommercial use, evaluation, and commercial use by companies with **US $1M or
less** in annual revenue. Derivative works must credit KitStack and inherit this
license. Companies above the revenue threshold need a separate commercial
license.
