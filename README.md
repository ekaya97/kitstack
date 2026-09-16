# KitStack

> **The runtime on the other side of the MCP boundary.**
> One MCP server acts as the router. The SDK gives you plugin-shaped primitives
> for the things a gateway never sees: versioned instructions, structured memory,
> a bounded agent loop, and one session that carries across chat, voice, and
> scheduled work. Every plugin writes into a single metadata-only telemetry
> record, so cost and outcome are attributed per intent, not per HTTP call.

[![Node 22+](https://img.shields.io/badge/node-22%2B-3fb950)](https://nodejs.org)
[![Protocol: MCP](https://img.shields.io/badge/protocol-MCP-4c6ef5)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org)

---

## What KitStack is

KitStack is a TypeScript SDK and router for building **kits**: self-contained
MCP applications with typed tools, in-chat views, versioned instructions, and an
optional bounded agent. A router exposes every kit through two static MCP tools,
`kit` and `kit_view`, so `tools/list` never changes and discovery is progressive.
Kits run on a plugin-composed host that supplies persistence, memory,
instructions, AI, HTTP, triggers, channels, an inference proxy, and a scheduler.
All of those plugins emit into the same telemetry record.

KitStack is an unreleased prototype. The reference implementation is a sales
voice agent in [`kits/debrief`](kits/debrief/) that runs one customer session
from a Claude prebrief, through a scheduled phone call, to an editable
confirmation View and a learned correction that changes the next run. See
[Status](#status) for what is verified and what is not.

---

## KitStack and MCP gateways

MCP gateways such as Microsoft's mcp-gateway, Agent Router, Tyk, TrueFoundry,
and Composio (see [awesome-mcp-gateways](https://github.com/e2b-dev/awesome-mcp-gateways))
make MCP servers accessible and governed at the boundary where a tool call
arrives. They are deliberately unopinionated and closer to enterprise maturity
than this repository. KitStack sits on the other side of that boundary.

| | MCP gateway | KitStack |
|---|---|---|
| Governs | The tool call: auth, RBAC, rate limits, filtered discovery | The work around the call: instructions, memory, loop, session, cost |
| Unit of registration | An MCP server or a tool definition | A kit: tools, views, instructions, triggers, agent |
| Session | Transport affinity key | A domain state machine spanning chat, voice, scheduler, and confirmation |
| Instructions | Not visible | Versioned files; the version served is logged on every session |
| Memory | Activity log | Structured entries: candidate, approved, published; retrieved on the next run |
| Agent loop | Rented from the client | `defineAgent`: one kit, one trigger, bounded, metadata-only hooks |
| Telemetry | Per request, OpenTelemetry | One record per operation across every plugin, with session, parent, trace, tokens, latency, cost, instruction versions, and memory IDs. Never prompts, completions, audio, transcripts, or tool payloads |
| Runs behind a gateway | | Yes. The router is a streamable HTTP MCP server |

Use both. Put a gateway in front for ingress, tool-level rate limits, and
Protected Resource Metadata. KitStack's telemetry carries `traceId` and
`parentId`, so its scheduler, voice, and memory spans can join a gateway's own
trace tree instead of forming a second one beside it.

---

## The primitives

### Kits, tools, views

A kit bundles a database schema, typed tools, optional interactive views, and
the instructions and triggers that tell the model when and how to use it.

```ts
// kit.config.ts
import { defineKit } from "@kitstackco/sdk";
import * as schema from "./src/schema";
import { instructions } from "./src/instructions";
import { addContact } from "./src/tools/add-contact";
import pipelineView from "./src/views/pipeline";

export default defineKit({
  id: "crm",
  version: "1.0.0",
  name: "CRM",
  description: "Contacts, deals, and pipeline backed by your system of record",
  schema,
  migrationsDir: "./migrations",
  instructions,
  triggers: ["crm", "contact", "deal", "pipeline"],
  tools: [addContact],
  views: [pipelineView],
});
```

```ts
// src/tools/add-contact.ts
import { z } from "zod";
import { defineTool, kit } from "@kitstackco/sdk";

export const addContact = defineTool({
  name: "add_contact",
  description: "Create a contact and return its ID for follow-up actions",
  args: z.object({
    name: z.string().describe("Full name"),
    email: z.string().email().optional().describe("Work email"),
  }),
  handler: async (ctx, args) => {
    const id = await insertContact(ctx.db, args);
    return kit.result(kit.created(id, "contact", `Contact ${args.name} added.`));
  },
});
```

Tools are shaped around what the agent is trying to do, not around API
endpoints. Aggregation, joins, and multi-step logic run in the handler; the
model receives a curated result plus the IDs it needs to chain the next action.
Over a long task that difference compounds, because every tool result is
re-sent on every later turn. The full argument is in
[Five Hard Problems in MCP](web/src/content/blog/mcp-shortcomings-and-how-kits-fix-them.mdx).

### Agents

`defineAgent` is a bounded, provider-neutral loop. It owns one run's session,
turn source, model seam, declared tools, instruction version, turn and
wall-clock limits, cancellation, and lifecycle hooks. Hooks receive names,
outcomes, counts, and durations. They never receive content.

```ts
import { defineAgent } from "@kitstackco/sdk";

const interviewer = defineAgent({
  id: "agent:sales-debrief",
  kitId: "debrief",
  trigger: { id: "trigger:sales-debrief", identity: "sales-debrief" },
  instructions: { version: "debrief-baseline@3f9c", content },
  turnSource,          // the channel supplies input turns
  model,               // one provider step per turn; returns a message or one tool call
  output,              // the channel receives output
  tools: [endCall, scheduleCallback],
  hooks: { onEvent: telemetry.record },
  maxTurns: 30,
  maxDurationMs: 10 * 60 * 1000,
});

const result = await interviewer.run({ sessionId, context, signal });
// result.status: completed | cancelled | timed_out | max_turns | failed
```

The boundary is deliberate: **one kit's tools, one trigger, no cross-kit
orchestration, no chains, no graph DSL.** KitStack ships the loop only where it
owns the channel and the client is absent. Anyone wanting general orchestration
uses the MCP surface with their own client. The loop's `run()` is the seam a
future runtime plugin can replace with a wrapped OpenAI Agents, Claude Agent
SDK, or Vercel AI loop, as long as the adapter keeps the same event contract and
routes inference through the KitStack proxy.

### Plugins

Every host capability is a plugin with a data-only manifest, so a host can
inspect what it runs before it runs it.

```ts
interface PluginManifest {
  id: string;
  kind: string;          // persistence | kit | memory | instructions | ai | http | trigger | channel | proxy | scheduler
  version: string;
  capabilities: string[];
  dependencies: string[];
}
```

Plugin invocations receive `requestId`, `traceId`, `parentId`, and an abort
signal, and their latency and outcome are recorded as telemetry. The reference
host registers ten plugins and the `/demo` dashboard lists them from the same
registry.

### The router

`tools/list` returns exactly two tools and never changes:

```
kit()                                    -> list kits this identity may use
kit(id="debrief")                        -> actions in a kit, with complexity hints
kit(id="debrief", cmd="prepare_debrief") -> parameter schema and instructions
kit(id, cmd, params)                     -> run
kit_view(id="debrief", view="prebrief")  -> render an interactive View in chat
```

Activating a kit never fires `tools/list_changed`, and the top-level tool count
stays at two regardless of how many kits exist. Details in
[packages/mcp-server/README.md](packages/mcp-server/README.md).

---

## What a gateway never sees

Five things run on KitStack's side of the boundary. Each exists in the
reference implementation today.

- **A session that outlives the request.** `prepared → calling →
  awaiting_confirmation → confirmed | partial → confirmed`, with `failed` on any
  provider error. The same session ID spans the Claude prebrief, the scheduled
  call, the confirmation View, the dashboard trace, and the correction.
  [`kits/debrief/src/contracts.ts`](kits/debrief/src/contracts.ts)
- **Instructions as versioned artifacts.** Served from files next to the kit,
  hashed, and the version logged on every run.
  [`kits/debrief/src/instructions/`](kits/debrief/src/instructions/)
- **Memory as structured entries, not transcripts.** A correction becomes a
  candidate, is approved, is published, and is retrieved by the next prebrief.
  [`kits/debrief/src/memory/`](kits/debrief/src/memory/)
- **A scheduler that places the call.** Persisted jobs with lease and
  idempotent claim; a job stuck past its lease is surfaced, never retried, so
  a phone never rings twice. [`kits/debrief/src/scheduler/`](kits/debrief/src/scheduler/)
- **One telemetry record for everything.** MCP calls, plugin invocations,
  memory reads and writes, instruction resolution, scheduler claims, voice
  turns, proxy usage, and cost, keyed by org, app, session, parent, and trace.
  [`kits/debrief/src/telemetry/`](kits/debrief/src/telemetry/)

---

## Reference implementation: the sales debrief kit

The presenter writes in an existing Claude thread:

> Use the debrief kit. I am meeting a client in two minutes. Call me back at
> 22:05. The client is Acme Corp, contact John Doe, location Köln Café.

1. `prepare_debrief` upserts the customer, retrieves prior events and approved
   memories, resolves the instruction version, persists one session, and
   schedules the call. It returns a compact prebrief and a `kit_view` hint.
2. `kit_view("debrief", "prebrief")` renders the prebrief with a countdown while
   the scheduler waits. No dashboard click is needed.
3. At the scheduled time the poller claims the job once and starts a Twilio
   call bridged to OpenAI Realtime under the `defineAgent` supervisor.
4. After the call, "give me the debrief for confirmation" opens an editable
   confirmation View. Confirming writes immutable customer events; confirming
   twice returns the same event IDs.
5. `kit_view("debrief", "customer-timeline")` shows the new events. A second
   customer cannot see them.
6. A correction taught in chat becomes a published memory. The next prebrief
   for the same customer retrieves it.
7. `/demo` in the web app shows the registry, scheduler state, provider health,
   per-app usage and cost, and the trace from prebrief to confirmation.

Tools: `prepare_debrief`, `get_session`, `get_debrief`,
`get_debrief_for_confirmation`, `update_debrief_draft`,
`confirm_debrief_draft`, `confirm_debrief`, `teach_from_correction`.
Views: `prebrief`, `confirmation`, `customer-timeline`.

The privacy boundary is part of the contract, not a setting: Twilio recording
is off, provider retention is off, and no audio, transcript, prompt, completion,
or tool payload is ever persisted. Phone numbers are masked in every response
and absent from telemetry.

---

## Run it locally

```bash
npm install
npm test                                   # 641 tests across the workspace gates
npm run demo:server                        # HTTP host on 127.0.0.1:3001, simulator by default
npm run dev --workspace kitstack-web       # web app; open /demo
```

Register the stdio transport in Claude Code or Claude Desktop with the
repository's [`.mcp.json`](.mcp.json), or run it directly:

```bash
npm run start:stdio --workspace @kitstackco/debrief-kit
```

The simulator is the default voice provider and is deterministic. A real phone
call requires Twilio and OpenAI Realtime credentials, a public HTTPS and WSS
hostname, and one allowlisted E.164 destination. See
[`.env.example`](.env.example) and [`kits/debrief/README.md`](kits/debrief/README.md).

---

## Architecture

```
  Claude (existing OAuth connector)
        │  kit / kit_view
        ▼
  MCP router  mcp.kitstack.co            packages/mcp-server   Lambda
   OAuth 2.1 + PKCE · onion dispatch · virtual debrief kit
        │  internal-signed JWT { sub, org, kit, req, trace, exp }
        ▼
  Debrief host  voice.kitstack.co        kits/debrief          one Fargate task
   plugin registry ─ persistence · kit · memory · instructions · ai
                     http · trigger · channel · proxy · scheduler
   transports    ─ POST /mcp · /t/voice/* · /v1/apps/* · /v1/chat/completions
                   /api/demo/observability · WS /t/voice/media
        │                      │                        │
        ▼                      ▼                        ▼
  libSQL / Turso        Twilio Calls +           OpenAI Realtime
  customers · sessions   Media Streams            (defineAgent supervisor)
  events · memory
  jobs · telemetry
        ▲
        │  metadata API
  /demo dashboard  (web, Next.js)   Runtime/Registry · Usage/Observability/FinOps
```

The router stays on SST-managed Lambda. The voice host runs beside it as one
ECS/Fargate task because Twilio media streams and the Realtime connection are
long-lived WebSockets. The database is remote so memory and telemetry survive
container replacement. None of the AWS pieces are load-bearing for the SDK:
the host binds to an injected host and port and runs anywhere Node runs.

| Layer | Tech |
|-------|------|
| SDK | `@kitstackco/sdk`: `defineKit`, `defineTool`, `defineView`, `defineLoader`, `defineAgent`, plugin registry, `serve()` |
| Router | Custom onion-pattern MCP server, stdio and streamable HTTP, OAuth 2.1 with dynamic client registration |
| Host | Node 22, plugin-composed, WebSocket upgrade for media |
| Data | libSQL / Turso, Drizzle ORM, Zod |
| Voice | Twilio Calls and Media Streams, OpenAI Realtime, G.711 μ-law 8 kHz |
| Reference infra | SST v3 on AWS: Lambda, ECS/Fargate, ALB, DynamoDB, S3, CloudWatch |

---

## Status

Verified locally with fake providers and in the deployed production stage:

- The existing Claude connector reaches the debrief kit through the router.
- All three Views render from the published shell.
- Customer, session, event, draft, memory, scheduler, and telemetry
  persistence survive a process restart.
- The two-run loop: a correction taught after run one is retrieved by run two.
- The scheduler claims a due job exactly once across two pollers.
- App registration, short-lived tokens, and the OpenAI-compatible proxy record
  identity, tokens, latency, and estimated cost.

Not yet verified:

- A credentialed, allowlisted phone call through the deployed Twilio and
  OpenAI Realtime path. The transport is composed and tested with fake
  sockets; it has not rung a phone from this repository state.
- `defineAgent` is a bounded lifecycle supervisor around a provider-owned
  Realtime connection. It does not yet own every audio turn or Realtime
  function-call event. A stream-native connector is future SDK work.

Known gaps against MCP gateways, planned and not shipped: per-tool
`assist`/`act` gating in the dispatch path, Protected Resource Metadata on the
router, tool-level rate limits, and a CRD or Helm deploy target.

---

## Repository layout

```
packages/
  sdk/            @kitstackco/sdk: define* primitives, plugins, serve(), CLI, build pipeline
  mcp-server/     MCP router: OAuth, onion dispatch, platform adapter, view shells
  authz/          Zanzibar-style tuple store: check, grant, revoke, listObjects
kits/
  debrief/        Reference implementation: sales voice agent kit + plugin-composed host
  crm/ expenses/ content-planner/ decision-journal/ projects/ adint/ fressnapf/
                  Earlier kits on the hosted platform path; useful as SDK examples
web/              Next.js app: docs, marketplace, /demo control plane
infra/            SST: mcp router, demo voice service, web, storage, secrets
```

---

## Documentation

- [Getting Started](web/content/docs/getting-started.mdx) and the SDK
  [concepts](web/content/docs/concepts/kits.mdx), [API reference](web/content/docs/api/define-kit.mdx),
  and [CLI](web/content/docs/cli/init.mdx)
- [Roadmap](web/content/docs/roadmap.mdx)
- [The onion pattern](packages/mcp-server/README.md)
- [The debrief kit and host](kits/debrief/README.md)
- [Local development and repository layout](CONTRIBUTING.md)
- [Five Hard Problems in MCP](web/src/content/blog/mcp-shortcomings-and-how-kits-fix-them.mdx)
  and [How Kits Work](web/src/content/blog/how-kits-work.mdx)

---

## License

[KitStack Community License 1.0](LICENSE). Source-available. Free for
noncommercial use, evaluation, and commercial use by companies with US $1M or
less in annual revenue. Derivative works must credit KitStack and inherit this
license. Companies above the threshold need a separate commercial license.
