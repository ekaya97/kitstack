# Ad Intelligence Kit — Spec

**Written 6 September 2026.** Reads alongside `kitstack-implementation-roadmap.md`,
`kitstack-north-star-spec.md`, `fressnapf-kit-spec.md` and `debrief-agent-spec.md`.

The third PoC kit. Fressnapf proves the API-plugin boundary; the debrief agent proves voice,
sessions and the trigger contract; **adint proves data-intelligence** — a shared cross-entity
store, a non-voice agent loop, scheduled capture, and a non-REST connector. Its job on the
platform is to be the second forcing function for the primitives the roadmap has not built
yet: `defineAgent`, `defineJob`/triggers, and pluggable retrieval + persistence.

adint already exists as a standalone product (`~/dev/adint`): it crawls German publishers,
captures display ads, resolves each ad to the advertiser brand, and surfaces the trigger
"brand X runs on your competitors but not on you — call their agency." This spec is how it
becomes a kit, and what building it teaches kitstack.

---

## 1. Constraints that shape everything

- **Dogfooding is the point, not a demo video.** Unlike Fressnapf, adint's value to us is the
  requirements it generates (§4). Every gap it hits is a platform ticket. Build it *through*
  the SDK, not beside it — Fressnapf shipped as seeded SQLite with no adapter and proved
  nothing about the plugin boundary (roadmap §8.2). adint must not repeat that with the store.
- **The cross-publisher signal is inherently shared.** "Deutsche Bahn on focus.de AND
  spiegel.de, not on Ströer" only exists when one store spans all publishers. This is the
  opposite of per-user libSQL and is the whole reason adint drives the storage adapter (OQ5).
- **Capture is a long-running service.** Headless-browser crawling is not request/response. It
  is a job + a connector, the same way the voice media stream is (roadmap §8.1). The *read*
  surface is request/response and fits today; the *capture* side does not.
- **The paywall is a grant, not a toggle.** adint's synthetic Ströer-integration overlay
  (adint ADR-0016) is "you want this for real? let's talk" data. On kitstack that becomes an
  entitlement: `kit:use` sees scraped intelligence; a premium relation unlocks the integration
  tier. More honest and more sellable than a demo switch.
- **Two kits, one motion.** adint and the debrief agent target the same customer. adint finds
  the opportunity; the debrief agent's `initiate_call` acts on it. Keep the seam clean so the
  chain is a platform composition, not a special case (§5).

---

## 2. Architecture

```
Claude / ChatGPT (rep asks: "who's advertising against us?")
   │  MCP (tools + views)
   ▼
kitstack kit: adint
   ├── tools/        read surface — triggers, ad-graph, brand timeline, publishers
   ├── views/        graph (cross-publisher), trigger detail   (chat host now, shell later)
   ├── domain/       ad-graph read model + trigger scoring (pure — ports from adint repo)
   ├── agent/        brand-enrichment loop      → defineAgent   (MISSING primitive, §4)
   ├── jobs/         scheduled crawl + enrich   → defineJob     (HALF-BUILT primitive, §4)
   └── plugins:
         ├── capture   (Bright Data headless browser)  → Connector  (non-REST, MISSING)
         ├── llm       (enrichment inference)           → Connector  (OQ 3d, MISSING)
         ├── store     (shared cross-publisher DB)      → storage adapter (P4, MISSING)
         └── blobs     (screenshots + ad markup)        → storage adapter (P4, MISSING)
```

The kit boundary is deliberately drawn so the **read surface ships today** on primitives that
already exist, and everything that needs a missing primitive is isolated behind a plugin
interface. That is what lets adint and kitstack move in parallel: a coding agent can build the
read kit now while another builds the primitive it will later sit on.

### What ports cleanly, and what does not

adint's `SqliteDashboardStore` already exposes exactly the read shape a kit wants —
`listTriggers`, `graphSlice`/`graphSliceAll`, `brandTimeline`, `graphPublishers`. These are
pure functions over the store and become `defineTool` load-tools almost mechanically. The
ad-graph builder (`presentation/domain/ad-graph.ts`) and trigger scoring are pure and copy in.

The capture pipeline (Bright Data driver, GAM parsing, blob store) does **not** port as a tool
— it is the job + connector layer and waits on those primitives.

---

## 3. The kit surface

### 3.1 Tools (read — buildable now)

Descriptions in English; the rep's prompt is English. Load-tools return typed data + a `view`
hint, mirroring Fressnapf.

| Tool | Input | Output → View | Notes |
|---|---|---|---|
| `list_triggers` | filter? (min score, vertical, publisher) | Trigger[] → **triggers** | The money tool. "Brand on competitors, not on Ströer → call agency." Ranked by score. |
| `get_trigger` | id | Trigger + evidence + timeline → **trigger_detail** | Screenshots, markup, publishers, score components, agency. |
| `ad_graph` | scope (publisher?, limit) | AdGraphNode[]/edges → **graph** | Cross-publisher / not-on-Ströer graph. Default = overview across all publishers' latest runs. |
| `brand_timeline` | brandId | Observation[] | Where and when a brand ran. |
| `list_publishers` | — | Publisher[] (with Ströer flag) | Portfolio + competitor set. |

Progressive disclosure is free: an empty/partial call routes to `handleDescribe` and returns
the tool's instructions (roadmap §8.1). `get_trigger` with no id explains how to find one.

### 3.2 Views

- **graph** — the cross-publisher graph: publishers → advertisers → creatives → brands, with
  not-on-Ströer buyers marked. This is the "aha" surface; it already server-renders in adint.
- **trigger_detail** — one opportunity: the brand, the competitor publishers it runs on, the
  resolved agency, the evidence blobs, the score breakdown, and a "brief the rep" CTA.
- **triggers** — the ranked opportunity list.

Chat host in MVP (P10 holds without a shell); shell host in Beta with the view host contract.

### 3.3 Agent — `defineAgent` (needs the primitive)

The brand-enrichment loop: for each new creative, read its screenshot + ad markup, identify
the advertiser (name, parent, vertical, landing domain, confidence), and write the brand.

**We have already run this loop by hand.** On 6 Sep 2026, four Claude subagents enriched 44
real captured creatives from screenshots + markup — 29 confident identifications across 21
brands (Leica, Deutsche Bahn, Smava, OTTO, TeamViewer, Canon…), 15 house-ads/blank slots
correctly rejected, no API key, no pipeline wiring. That manual pass **is** `defineAgent`:

```ts
defineAgent({
  id: "brand-enricher",
  trigger: onNewCreatives,        // §3.5 — schedule or capture-complete
  model: "auto",                  // conversation/vision split; §9.4 roadmap
  instructions,                   // the German publisher/ad-house noise rules + confidence
                                  // calibration we wrote for the subagents → SKILL.md
  tools: [read_creative_blob, write_brand],   // one kit, one trigger (§9.2 boundary holds)
});
```

adint is `defineAgent`'s **non-voice first customer** — the debrief interview loop is
latency-bounded and specialized (roadmap §9.3), so a generic v1 loop should prove itself on
adint's batch enrichment first.

### 3.4 Jobs & triggers — `defineJob` / `defineTrigger` (half-built / missing)

- **Scheduled crawl** — `defineJob` schedule: crawl the publisher set on a cadence.
- **Capture-complete → enrich** — a trigger that fans new creatives into the enrichment agent.
- **Opportunity fires** — when a new not-on-Ströer cross-publisher brand appears, emit a
  trigger. In MVP this surfaces to the rep over MCP; the auto-chain to the debrief agent is a
  Trigger-plugin concern (roadmap step 7).

### 3.5 Connectors & storage (missing)

- **capture** — Bright Data headless browser. A **non-REST connector** — the second connector
  shape after Fressnapf's REST storefront, which is what proves the connector interface is not
  REST-only ("two instances prove an interface; one proves nothing", roadmap §5 step 8).
- **llm** — enrichment inference as a connector (roadmap OQ 3d: LLM as connector inherits
  secrets-at-bind-time + per-org model pinning).
- **store** — the shared cross-publisher DB. Not per-user libSQL. This is adint's biggest
  demand on the platform (§4).
- **blobs** — screenshots + ad markup. A blob/object store adapter.

---

## 4. What adint dogfoods — the requirements matrix

This table is the reason to build adint now. Each row is a platform requirement adint exercises
end to end, with the roadmap item it drives. Rows marked EXISTS are buildable today.

| adint need | kitstack primitive | Status today | Drives / dogfoods |
|---|---|---|---|
| Read surface (triggers, graph, timeline) | `defineTool` (load) | **EXISTS** | — buildable now; the parallel-start slice |
| Graph / trigger dashboards | `defineView` (chat) | **EXISTS** | view host contract, shell host (MVP step 3 → Beta) |
| Brand-enrichment loop | `defineAgent` | **MISSING** (§9) | `defineAgent` v1 — its **non-voice** first customer |
| Enrichment prompts / noise rules / calibration | `instructions` / SKILL.md | **EXISTS** (baseline) | in-band instruction serving (roadmap §8.5) |
| Scheduled crawl | `defineJob` (schedule) | **HALF-BUILT** | one-shot + cron `defineJob` (roadmap §8.2) |
| Capture-complete / opportunity events | `defineTrigger` (schedule/webhook) | **MISSING** | Trigger plugin (MVP step 7) |
| Bright Data headless capture | Connector (**non-REST**) | **MISSING** | second connector shape — proves the interface |
| Enrichment inference | Connector (LLM) | **MISSING** | OQ 3d (LLM-as-connector) |
| **Shared cross-publisher store** | storage/persistence adapter (P4) | **MISSING** | **the storage adapter** (OQ5) — 2nd forcing kit after debrief's Dynamo |
| Blob store (screenshots, markup) | object-store adapter (P4) | **MISSING** | blob/object plugin under the same adapter question |
| Retrieval over the ad-graph | retrieval plugin | **MISSING** | "plugin-based retrieval" — the read side of the store adapter |
| Data-tier paywall (ADR-0016 overlay) | grants (`kit:use` vs premium) | **~60% built** | grants widening (MVP step 3b) — a real entitlement use case |
| Cost per enrichment, signal provenance | telemetry + audit | name-only | telemetry schema (MVP step 9) |
| adint opportunity → debrief call | cross-kit via dispatch/trigger | **MISSING** | dispatch core + trigger (MVP steps 4, 7) |
| "Customer adds publishers himself" | Kit Builder (generated tier) | Beta | Kit Builder (roadmap §6) — adint's own north star |

**Two observations for the platform team.** (1) adint provides the *second instance* of three
interfaces the roadmap says are unproven with one instance: a non-REST connector, a non-voice
`defineAgent`, and a non-per-user store. (2) adint and the debrief agent both demand the
storage adapter (shared DB / Dynamo) — that makes it a two-kit requirement, not a debrief
special case, and moves the decision from "someday" to now (roadmap risk §10).

---

## 5. The cross-kit motion: find → call

adint produces a **lead** ("Deutsche Bahn runs on focus.de + spiegel.de, not on Ströer;
agency = X"). The debrief agent's `initiate_call(rep, purpose, account, …)` produces the
**call**. Per roadmap §9.2 this is *not* one agent — no cross-kit orchestration inside a loop.
The composition happens at the dispatch/trigger layer:

- **MVP (rep in the loop):** adint surfaces the opportunity over MCP; the rep (or their client)
  invokes the debrief kit's `initiate_call`. This is "the MCP surface with their own client —
  the product working as designed" (§9.2).
- **Beta (auto-chain):** adint's opportunity trigger fires into the debrief kit's `http`
  trigger under a service identity, same validation (roadmap §8.1). Now the platform is the
  sales motion, not just the tool shelf.

This is the clearest possible statement of the platform thesis: two independently-built kits,
different shapes (data vs voice), composing through the dispatch core into one workflow.

---

## 6. Porting stages

Sequenced so parallel agents never block each other and no shortcut hides a boundary.

**Stage A — read kit, now (no missing primitives).**
Copy adint's pure read model + ad-graph into `kits/adint`; expose the §3.1 tools over the
existing adint SQLite as a **kit-local store, explicitly labelled a shortcut** (Fressnapf's
pattern, but named as debt against the storage adapter so it is not mistaken for the boundary).
Chat-host graph + trigger views. Deliverable: talk to adint's intelligence from Claude, and
demo find→call by hand-calling the debrief kit. Unblocks: the whole read/UI lane.

**Stage B — rides the MVP spine.**
Enrichment `defineAgent` (its manual proof is done, §3.3); Bright Data + LLM connectors;
capture `defineJob`; the shared store + blob adapter replacing the Stage-A shortcut; grants
paywall; telemetry per enrichment. Each lands as its platform primitive lands, with adint as
the primitive's first or second caller.

**Stage C — Beta.**
Shell views; opportunity→debrief auto-chain; Kit Builder for publisher onboarding (adint's
"customer adds publishers" north star = the generated tier).

---

## 7. Open questions

1. **Where does adint's code live?** Copy the pure domain (read model, ad-graph, enrichment
   instructions) into `kits/adint` now and keep the capture pipeline in the adint repo until
   the connector/job primitives exist; converge later. Alternative: workspace dependency on the
   adint package. Recommend copy-first for the pure, stable modules; note the drift risk and
   revisit when the store adapter lands. *(this week)*
2. **Storage adapter shape** — the same question as roadmap OQ5, now with a second customer.
   Does `ctx.db` become pluggable (libSQL | shared-SQL | object-store), or does adint run its
   store behind a connector as a labelled exception through Stage A? Recommend: Stage A uses the
   labelled exception; Stage B is where the adapter is actually designed, with adint + debrief
   as its two callers. *(blocks Stage B)*
3. **Does the enrichment agent run on `defineAgent` v1, or stay a script through Stage A?**
   Recommend: keep the manual/subagent enrichment as a batch script for Stage A (it works
   today), and make adint the first integration test of `defineAgent` v1 when it exists. *(when
   defineAgent v1 lands)*
4. **Retrieval interface** — is ad-graph retrieval a query API on the store adapter, or a
   distinct retrieval plugin? Answer with the store adapter in Stage B; do not design a separate
   retrieval primitive before the store one exists. *(Stage B)*

---

## 7a. Handoff & workstream

This kit is handed off to kitstack for parallel dogfooding. The living work list is the tracker,
not this doc (IDs drift): **`track list --label adint`**, epic **T-0126**. Stage filters:
`--label stage-a | stage-b | stage-c`. Cross-cutting platform findings adint drives:
`--label dogfood`. Every ticket cites the `~/dev/adint` source paths to port. What is startable
now vs. blocked is encoded via `depends_on` — see `track list --label adint --available`.

Shape of the workstream: Stage A (read kit, built — T-0122 + polish/tests T-0127/T-0128);
platform primitives adint needs (LLM connector T-0129, object store T-0130, Bright Data
connector T-0131, storage adapter T-0125, defineAgent T-0124); Stage B port (brand write
T-0135, capture job T-0136, GAM+privacy T-0137, capture-time resolution T-0132, campaigns
T-0138, agency T-0139, insight/scoring T-0140, grant paywall T-0133, eval T-0141); Stage C
(shell dashboard T-0134). The `;`-splitter bug T-0123 is an independent platform fix.

## 8. Out of scope (for now)

Real-time capture, multi-country, the full agency-network resolution beyond the trigger's
needs, and any auto-chain to the debrief agent before the trigger plugin exists. None of it
changes the kit boundary drawn in §2.
