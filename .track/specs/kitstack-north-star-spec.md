# KitStack — North Star Spec

**Version 1.0 · 5 September 2026 · Internal (Enes + first Werkstudent). Customer/investor versions are subsets of this document.**

---

## 0. What this document changes

The README sells **token-efficient MCP tooling**: workflow-level actions, curated results, one static `kit` tool, self-hosted router. That stays as the technical wedge.

The platform thesis on top of it:

1. **One router for all MCP applications in the enterprise.** Teams are spinning up MCP servers per system with no auth enforcement, unoptimized tools and no overview. KitStack centralizes them.
2. **Devs build against the SDK and deploy with one CLI call.** Integrations and triggers are plugins; data sources are pluggable.
3. **One dashboard shell, apps inside it, grants decide what you see.** Admin and dev are the same interface with different grants. Every kit can ship its own app.
4. **Channels** — MCP is one way to reach kits. Voice, triggers/events and later an OpenAI-compatible proxy are others. Same dispatch, same identity, same audit.
5. **Skills as an internal package manager.** `kit add skill` delivers versioned, signed skills into the repo. Dev tool first, consumer marketplace second.

One-liner:

> **KitStack is the self-hosted platform to build, run and govern every MCP application in your enterprise — token-efficient by design, deployable in one command, controlled through one set of grants.**

### 0.1 Current state (fill in from the repo before the Werkstudent starts)

| Area | Exists | Half-built | Name only |
|---|---|---|---|
| Runtime: onion router, `serve()`, stdio+HTTP | ✔ | | |
| SDK: `defineKit`, `defineTool`, `defineView`, `defineLoader`, `createTestKit` | ✔ | | |
| Views in chat (AppData iframe) | ✔ | | |
| Per-kit libSQL + Drizzle, migrations | ✔ | | |
| Auth adapters (`none`, OAuth, custom) | ✔ | | |
| Registry + entitlements (single-user) | ✔ | | |
| CLI: init/dev/build/deploy/serve/login/call | ✔ | | |
| SST reference deploy | ✔ | | |
| Skills marketplace (consumer) | ✔ | | |
| Org/team RBAC, admin-gated deploy | | ✔ | |
| `defineJob` + scheduling | | ✔ | |
| Connector interface + library | | | ✔ |
| Channels: Voice, Trigger, Proxy | | | ✔ |
| Telemetry + audit stores | | | ✔ |
| Dashboard shell + apps + grants | | | ✔ |
| Identity: interactive / delegated / service | | | ✔ |
| Entra integration, router as OAuth server | | | ✔ |
| Kit Builder skills | | | ✔ |
| Eval harness | | | ✔ |

---

## 1. Principles

| # | Principle | Consequence |
|---|---|---|
| P1 | **Workflow tools, not CRUD.** The handler does the `GROUP BY`; the model gets a decision. | Kit Builder refuses to generate endpoint mirrors. Eval harness measures token footprint per workflow. |
| P2 | **One static tool, progressive disclosure.** `tools/list` never grows. | Every channel routes through the same dispatch. No side doors. |
| P3 | **Kits map to roles, not data domains.** | Entitlements are role-shaped. Big domains split into several kits. |
| P4 | **Everything is a plugin.** Connectors, triggers, channels, auth, storage, deploy targets, skills. | `serve()` is the only runtime. Adapters, not forks. |
| P5 | **People in the middle.** Kits assist; autonomy is opt-in per tool and visible in audit. | Every tool declares `mode: assist \| act`; `act` requires a grant. |
| P6 | **Credentials never live in kit code.** | Connectors resolve secrets at bind time, scoped to the calling identity. |
| P7 | **Self-hosted first.** Customer VPC is production; kitstack.co is dev/eval. | No feature depends on kitstack.co being reachable. |
| P8 | **Locally developed, centrally managed.** Departments build; IT approves, deploys, observes. | Admin-gated deploy is a v1 requirement. |
| P9 | **One grant primitive.** Tool use, dashboard access, telemetry visibility, deploy rights are all `grant(identity, scope, resource)`. | No second permission system, ever. Admin = more grants. |
| P10 | **Dogfood the primitives.** The platform's own apps are built only from the primitives devs get. | If the platform kit can't build it, the primitives are missing. |

---

## 2. Domain model

| Concept | Definition | Status |
|---|---|---|
| **Kit** | Self-contained connector to one role's workflows: schema, tools, views, app, instructions, triggers. | exists |
| **Tool** | `defineTool({ mode, args, handler })`; handler is server-side code over injected `ctx`. | exists → extend |
| **View** | UI component bound to loaders. Renders in two hosts: chat iframe and dashboard shell. | exists → host contract |
| **App** *(new)* | A kit's routed set of views in the dashboard shell. Deployed with the kit. | new |
| **Loader** | Server-side data provider for views/apps. | exists |
| **Job** | `defineJob` — scheduled or triggered background work. | in development |
| **Trigger** *(new)* | Plugin ingress that starts a session: HTTP endpoint, webhook, schedule. | new |
| **Connector** *(new)* | Typed adapter to an external system behind one interface; bound by the platform. | new |
| **Channel** *(new)* | How a session reaches kits: MCP, Voice, Trigger, Proxy. | MCP exists |
| **Identity** | Tuple `{principal, actor, delegation?}` per session. Types: interactive, delegated, service. | new |
| **Grant** | `grant(identity|role, scope, resource)`. The only permission primitive. | replaces entitlements |
| **Registry** | Kits, versions, apps, connector bindings, grants, deploy state. | exists (single-user) |
| **Policy** *(new)* | Declarative rules at dispatch: deny lists, argument constraints, redaction, rate limits. | new |
| **Telemetry event** *(new)* | High-volume, TTL'd: session, tool_call, connector_call, policy_decision, cost. | new |
| **Audit event** *(new)* | Low-volume, append-only, hash-linked: identity tuple + decision + result hash. | new |
| **Skill** | Versioned, signed instruction package for coding agents; delivered by `kit add skill`. | marketplace exists → package manager |

---

## 3. Architecture

```
                    Channels
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │   MCP    │ │  Voice   │ │ Trigger  │ │  Proxy   │
   │stdio/http│ │SIP/Twilio│ │http/web- │ │ OpenAI-  │
   │          │ │↔realtime │ │hook/cron │ │compatible│
   └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
        └────────────┴──────┬─────┴─────────────┘
                            ▼
   ┌────────────────────────────────────────────────────┐
   │ Router — one static `kit` tool, onion dispatch       │
   │ identity · grants (cached) · policy · telemetry/audit│
   └──────────────────────────┬─────────────────────────┘
                              ▼
   ┌────────────────────────────────────────────────────┐
   │ Registry — kits, versions, apps, bindings, grants    │
   └──────┬──────────────┬──────────────┬───────────────┘
     ┌────▼────┐    ┌────▼────┐    ┌────▼────────┐
     │sales-rep│    │ap-clerk │    │ platform    │  kits (SDK)
     │  kit    │    │  kit    │    │ kit (admin) │
     └────┬────┘    └────┬────┘    └────┬────────┘
          │ ctx.db · ctx.connectors · ctx.identity · ctx.telemetry
          ▼              ▼              ▼
   ┌────────────────────────────────────────────────────┐
   │ Integration library — Connector interface            │
   │ SQL · NoSQL · REST/OpenAPI · M365 Graph · CRM ·      │
   │ Telephony · Files · custom (signed)                  │
   └────────────────────────────────────────────────────┘

   Dashboard shell (web): auth · routing · app registry · primitives
     └─ apps: platform (sessions, cost, grants, deploy queue) + every kit's app
   Stores: registry (Dynamo) · telemetry (TTL days) · audit (append-only)
   Identity provider: Entra / Okta / OIDC via router-as-OAuth-server
```

### 3.1 Runtime (exists — keep, extend)

- Onion MCP server, stdio + HTTP; `serve()` for local, container, Lambda.
- **Add daemon mode** (`serve({ mode: "daemon" })`) for Voice and Trigger — long-lived connections, no cold starts.
- Per-kit libSQL via Drizzle; `DbConfig` may target shared/org DBs.

### 3.2 SDK (extend)

```ts
export default defineKit({
  id: "sales-rep",
  role: "Sales representative",
  connectors: ["hubspot", "postgres:sales", "m365.graph"],
  channels: ["mcp", "voice"],
  triggers: [afterMeeting],                 // Trigger plugins
  tools: [...], views: [...], jobs: [...],
  app: { routes: [...] },                   // dashboard app, optional
  instructions, keywords,
});

defineTool({
  name: "log_meeting_outcome",
  mode: "act",
  classification: "internal",
  args: z.object({...}),
  handler: async (ctx, args) => {
    const deals = await ctx.connectors.hubspot.deals.byContact(args.contactId);
    await ctx.db.insert(meetings).values({...});
    ctx.telemetry.metric("meeting_logged", 1);
    return { dealId: deals[0].id, nextStep: "..." };
  },
});
```

`ctx = { db, connectors, identity, channel, telemetry, audit, log }`. Shim for the bare-`db` signature for one minor version.

**View contract (decide before the first Werkstudent view):**

```ts
defineView({
  id: "pipeline",
  loaders: [pipelineLoader],
  render: (data, host) => <Pipeline data={data} host={host} />,
});
// host: { kind: "chat" | "shell", size, navigate(), identity, theme }
```

Same component, two host adapters. Never write a dashboard view twice.

### 3.3 Integration library (new)

```ts
interface Connector<Config, Client> {
  id: string;
  configSchema: ZodType<Config>;
  connect(ctx: BindContext<Config>): Promise<Client>;  // secrets + identity resolved here
  health?(client: Client): Promise<HealthStatus>;
  audit?: AuditHooks;
  limits?: RateLimitSpec;
}
```

- Kits declare connector IDs; the platform binds instances from the org connector registry at deploy.
- Scoping: connectors receive the identity tuple. OBO where the target supports it (Graph, Salesforce); service account + policy where it doesn't.
- v1 set: `postgres`/`mysql`, `dynamodb`, `rest` (+ OpenAPI import), `m365.graph`, `twilio.voice`. Then `hubspot`, `salesforce`, `s3`/`sharepoint`, `slack`.
- Custom connectors implement the interface; published through the registry with a signature check.

### 3.4 Triggers (new)

Trigger plugins are ingress that start a session with a fixed identity and kit allowlist:

- `http` — authenticated endpoint per kit (`POST /t/sales-rep/after-meeting`).
- `webhook` — provider-signed (Calendar, CRM, Twilio status callbacks).
- `schedule` — cron or one-shot ("call rep X at 16:30") via `defineJob`.

A trigger may start a Voice session. A kit may call the router it is served from — it is just another client with a delegated or service identity (see 3.6).

### 3.5 Channels (new)

| Channel | Mechanics | Notes |
|---|---|---|
| **MCP** | As today. Client-agnostic: Claude, Copilot, ChatGPT, custom. | Never pitch a specific client. |
| **Voice** | Telephony ingress (Twilio Media Streams first, SIP later) → realtime speech model → kit tools as function calls → transcript/outcomes persisted via the kit's own tools. Call = session. Post-call Job. | Provider adapter from day one. Daemon mode. |
| **Trigger** | See 3.4. | Autonomous → `act` only with grant; audit mandatory. |
| **Proxy** | OpenAI-compatible endpoint; router injects identity, selects kits, attaches tools, forwards to configured model. | Later. Decide product boundary after two enterprise talks. |

### 3.6 Identity

Every session carries `{ principal, actor, delegation? }`.

| Type | Example | Grants evaluated on | Entra mechanism |
|---|---|---|---|
| **Interactive** | Rep in a chat client | principal | OIDC login |
| **Delegated** | Voice agent calling rep X about X's meeting | principal ∩ actor, time-boxed | On-Behalf-Of token exchange (RFC 8693) |
| **Service** | Nightly digest job | actor only | Client credentials / managed identity |

Audit stores the whole tuple. The router mints the actor identity per session — no shared context across agents.

**Entra integration:** enterprise app registration; groups/app roles → KitStack roles → grants (mapping edited in the platform app); OBO for the `m365.graph` connector; SCIM provisioning later.
**Known gotcha:** MCP auth expects OAuth 2.1 with dynamic client registration; Entra has none. The router is its own OAuth authorization server that federates to Entra. Clients register with the router; the router logs users in against Entra. This is the feature, not a workaround — put it in proposals.

### 3.7 Grants, cache, policy

- Single table: `grant(subject: identity|role, scope, resource)`. Scopes: `kit:use`, `kit:act`, `kit:deploy`, `kit:telemetry`, `kit:admin`, `platform:admin`. Dashboard visibility is the same scopes.
- **Cache:** 5–15 minutes per warm process, plus a registry version counter checked per request (one cheap read); refetch on change. Answer to "how fast can I revoke?": under a minute.
- **Policy:** YAML rules evaluated in the onion before the handler — deny lists, argument constraints, classification-based redaction, per-identity rate limits.

### 3.8 Telemetry and audit — two stores

| | Telemetry | Audit |
|---|---|---|
| Content | session, tool_call, connector_call, policy_decision, cost — with payload sizes and tokens | identity tuple, decision, tool, result hash |
| Volume | high | low |
| Retention | TTL days (configurable) | years, append-only, hash-linked |
| Sink | OpenTelemetry exporter → DynamoDB w/ TTL now, ClickHouse when queries hurt; enterprises point it at their own collector | separate table, SIEM export |
| Owner | `platform` kit owns schema + loaders | same |

No standalone telemetry service: OTel exporter in router and `ctx.telemetry` in kits, plus the platform kit. Employee metrics aggregate by default; individual traces need a role (Betriebsrat-safe).

### 3.9 Dashboard shell and apps

- **Shell:** web app — auth (via router OAuth), routing, app registry, primitives. Devs bring React.
- **Primitives:** loader client, `host` adapter, small component set (table, chart, timeline, form, grant editor). The platform kit's apps use only these (P10).
- **Apps:** every kit may declare `app.routes`; `kit deploy` publishes the app with the kit. Visibility by grants: a dev sees apps for kits they hold `kit:telemetry`/`kit:admin` on; `platform:admin` sees all.
- **Platform kit apps:** sessions & cost per tool/kit/team, grants editor, connector bindings, deploy queue (pending requests, eval table, approve).
- There is no separate admin or dev dashboard. Admin = more grants.

### 3.10 Kit Builder and skills

Three tiers: config kit (connector + template, no code) · generated kit (agent introspects OpenAPI/schema, proposes workflow tools, generates, tests, evals → PR) · coded kit (SDK). Generator hard rule: P1.

**Skills as package manager:** `kit add skill <org/name>@version` pulls a signed skill into the repo skills folder; org-private registries; kit-builder skills and enka's own principles ship the same way. This is the dev-tool product; the consumer marketplace stays up without new investment.

### 3.11 Eval harness

`createEval`: workflow scenario, CRUD baseline, kit surface; measures round-trips, result tokens, cumulative context after N turns, task success. Runs in CI; table attached to every deploy request. Every run is labeled trajectory data.

---

## 4. Deployment and tenancy

| Mode | Where | For |
|---|---|---|
| Local | `kitstack dev` | kit + app development |
| Eval cloud | kitstack.co, per-user DBs | try it; companies under license threshold |
| Self-hosted | Customer VPC — SST/AWS reference, container/K8s, or one VM | production; their IdP, network, data |

---

## 5. Security and governance

- Four gates before a system is touched: identity → grant → policy → connector scope.
- No secrets in kits; secrets-manager adapters (AWS SM, Vault, Azure KV).
- Audit chain with SIEM export; telemetry TTL'd separately.
- Compliance mapping table (ISO 27001 A.5/A.8, BSI Grundschutz APP/ORP, NIS2 Art. 21) — document, don't over-claim.
- Aggregate-by-default employee metrics; transcript retention configurable.
- Signed connectors and skills; SBOM for the runtime; pinned model providers per org.

---

## 6. How we work (internal)

- **Kit is the unit of work.** Feature = kit or connector or skill, never "a change to the platform" without one of those attached.
- **Every PR carries the eval table.** No table, no review.
- **Principles are repo context.** P1–P10 live as an LLM-enforced skill; Claude Code loads it in every session.
- **Troubleshooting builds the platform app.** Need to understand or measure something → add a telemetry field + a platform-kit view. Never a one-off script.
- **Schema before panel.** A view may only read the telemetry/registry schema. Missing data → extend schema.
- **Werkstudent path:** first view (host contract) → first connector → first kit → first Kit Builder skill. Thesis candidate: eval harness / dataset construction from trajectories.

---

## 7. Implementation path

### Phase 0 — Prove kit + channel (now → Sun 7 Sept 2026)
- Fressnapf kit (API plugin type, Playwright behind tools, MCP views).
- Minimal voice agent: Twilio → realtime model → two kit tools. One hard-coded delegated identity, stated as such.
- Telemetry schema + one Dynamo table with TTL; platform kit with two chat views: sessions, cost per tool.
- **Gate:** both demoed end to end; tokens per call and per Fressnapf query written down.

### Phase 1 — v1: governable single-org platform (Oct → Dec 2026)
- `ctx` refactor, `mode`, `connectors:`, view `host` contract.
- Connector interface + `postgres`, `rest/openapi`, `m365.graph`, `twilio.voice`.
- Grants table + cache + version counter; roles; admin-gated deploy; identity tuple with the three types; router as OAuth server federating to Entra.
- Triggers (`http`, `webhook`, `schedule`) + `defineJob`; daemon mode.
- Dashboard shell v0 with primitives; platform apps: sessions/cost, grants, deploy queue.
- Audit store separated from telemetry.
- Voice hardened: reconnects, barge-in, post-call job.
- `kit add skill` against an org-private registry.
- Eval harness v0.
- **Gate (Dec):** Ströer proposal submitted with a live sales-agent kit, a measured baseline, and the identity/Entra story. Werkstudent hired, first view shipped.

### Phase 2 — Control plane and Kit Builder (Jan → Jun 2027)
- Policy engine, OTel export, SIEM export, cost-per-intent per team.
- Kit Builder generated tier as skills; config-kit templates for v1 connectors.
- `hubspot`, `salesforce`, `s3/sharepoint`; SCIM.
- Kit apps for third-party kits; per-kit app publishing in `kit deploy`.
- Ströer rollout unit by unit.
- **Gate (Jun):** sales agent live in ≥1 unit with measured KPI delta; compliance mapping exists; one non-Ströer enterprise evaluating.

### Phase 3 — Platform product (Jul → Dec 2027)
- Proxy channel beta; signed community connectors and skills; self-serve config kits in the shell.
- Commercial license motion live.
- **Gate (Dec 2027):** two paying self-hosted enterprises → spin-off candidate under the studio model.

### Non-goals through 2027
- No multi-tenant hosted production SaaS for enterprises.
- No general agent framework; orchestration belongs to the client or to Jobs.
- No paid marketplace before two paying platform customers.
- No MCP features that break P2.
- No second permission system, no second dashboard.

---

## 8. Sales motions

### 8.1 Project-led (primary, now)
Every PoC is a kit; every follow-up project ships on KitStack in the customer's VPC. Rules: their data, one named owner with a number, 80 % finished, price at the demo, two weeks from data to demo.

**Ströer pitch (Situation–Komplikation–Lösung):**
1. Ihre Teams bauen MCP-Server für Agents — pro Team, pro System, jeder anders.
2. Kaum Auth, unoptimierte Tools, hohe Token-Kosten, kein Überblick. Schatten-IT 2026.
3. KitStack ist der eine Router: Admin sieht alle Kits, jeden Aufruf, jede Identität. Devs nutzen das SDK gegen ihr System, deployen mit einem Befehl. Integrationen und Trigger sind Plugins.
4. Zwei Beispiele laufen: Fressnapf-Shopping-Agent, Sales-Voice-Agent, der Vertriebler anruft und im Chat-Client erreichbar ist, den sie schon haben. Kein App-Rollout.
5. Nächster Schritt: Sales-Agent bei einer Unit, messen, ausrollen. 12 Monate, Retainer + Phasen-Gates. Proposal Dezember, Start Februar.
Metric fixed in the PoC: CRM completeness after meetings, time-to-follow-up, meetings booked per rep. Non-technical gates named up front: Datenschutz, Betriebsrat (§ 87 BetrVG), Entra/IdP.

### 8.2 Enterprise platform (2027)
Buyer: CIO/CISO with FinOps present. One MCP surface IT controls; departments build kits; every intent has an owner and a cost; identity/Entra done properly. Lead with security background and compliance mapping. Proof: Ströer, eval numbers, audit export.

### 8.3 Partner / agency
Agencies build kits for clients on KitStack; they get speed and governance, KitStack gets distribution. Give the first partner the Kit Builder skills early.

### 8.4 Developer / inbound
Source-available SDK; `kit add skill` as the daily-use hook; deep-dive posts plus per-connector eval numbers.

### 8.5 Pricing sketch (validate, don't publish)
Commercial license annual, tiered by live kits and connected identities; implementation via enka retainer; eval cloud free under threshold.

---

## 9. Metrics

| Metric | Why |
|---|---|
| Token footprint per workflow, kit vs CRUD | the technical claim, per kit |
| Description → deployed kit, per tier | Kit Builder |
| Kits and apps built by non-founders | "anyone can build" |
| Intents with cost attribution | FinOps sale |
| Revocation latency | security claim |
| PoCs → data → demos → pilots | sales conversion |
| Enterprises self-hosting in production | traction |

---

## 10. Risks and open questions

- MCP spec drift (apps, auth): adapters everywhere; the onion is ours.
- Realtime voice provider churn: adapter, never expose provider types to kits.
- Lambda vs daemon: reference deploy must show both without forking the runtime.
- Per-kit SQLite at org scale: shared org DB path before Phase 3.
- Landscape (Composio, Arcade, hyperscaler MCP gateways) overlaps on connectors; differentiation is P1, self-hosting, grants/identity, skills packaging. Check quarterly, don't chase parity.
- Founder bandwidth: KitStack and fallex compete for the same person. Phases 1–2 run at full speed only if the Ströer program funds them.
- Open: Proxy in KitStack or separate product — decide after two enterprise conversations.
- Open: shell hosting — served by the router process or separate static deploy? Decide with the view contract.
