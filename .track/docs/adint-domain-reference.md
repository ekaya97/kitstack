# adint — Domain Reference (for the KitStack kit)

**Written 6 September 2026.** Everything a coding agent needs to know about adint to build and
extend the `kits/adint` kit without reading the whole adint repo (`~/dev/adint`). Pairs with
`.track/specs/adint-kit-spec.md` (the kit design) and `.track/docs/adint-brand-enrichment.md`
(the enrichment loop = the `defineAgent` proof). Where this doc cites adint source, the path is
relative to `~/dev/adint`.

---

## 1. What adint is

A German ad-intelligence product for **Ströer** (an out-of-home + digital publisher /
ad-sales house). It answers one sales question:

> **Which brands are advertising on our competitors' sites but NOT on ours — and which agency
> should we call?**

Pipeline in one line: crawl German publishers → capture display ads → resolve each ad to the
advertiser brand → find brands that run across competitor publishers but not on Ströer → emit a
ranked "call this agency" trigger.

The **cross-publisher bridge is the whole product.** GAM advertiser/campaign/creative IDs are
per-publisher (0 shared across publishers in real data). The only identity that crosses
publishers is the **brand**, derived from the ad's landing domain / creative. So brand
resolution is not a nice-to-have — it is the signal.

Key product decisions (adint ADRs, in `docs/adr/`):
- **ADR-0010** — a "trigger" is *an agency call on a live campaign*. "Not on Ströer" needs only
  ONE competitor publisher (one is enough to pitch). Cross-publisher (≥2) is the stronger signal.
- **ADR-0009** — no user identifiers are ever persisted (consent strings, cookies, device IDs).
- **ADR-0016** — a synthetic Ströer-integration overlay is a *toggleable demo/pitch* layer,
  never real data. On KitStack it becomes a **grant** (premium tier), not a toggle.
- **ADR-0002/0003/0004** — one SQLite file, local content-addressed blob store, single box.
- **ADR-0019** — adint is developed as a KitStack kit (this whole effort).

---

## 2. Bounded contexts (adint code layout, ADR-0007)

adint is DDD with strict layering (domain / application / infrastructure; no cross-context
domain/infra imports). Contexts:

| Context | Does | Relevant to the kit? |
|---|---|---|
| `registry` | discovers publishers from ads.txt, classifies them | Publisher list only |
| `capture` | crawls + captures ads (Bright Data headless browser, GAM parsing, blob store) | **Stage B** (connector + job) — NOT Stage A |
| `resolution` | resolves creatives → brands (enrichment), agencies | **Stage B** agent; the brand model ports |
| `campaigns` | groups creatives into campaigns, classifies campaign type | Stage B+ (produces `campaign` rows) |
| `insight` | scores triggers, emits `event` rows | Stage B+ (produces `event` rows = triggers) |
| `presentation` | the dashboard: read model + ad-graph + trigger views | **Stage A** — this is what ports now |

**Stage A ports the `presentation` context only.** It is pure read logic over the SQLite store.
Everything upstream (capture, resolution, campaigns, insight) is the pipeline that *fills* the
store; Stage A reads what is already there.

---

## 3. The data model (SQLite tables the read surface touches)

adint's store is one SQLite file (`~/dev/adint/data/adint.sqlite`). The tables the Stage-A read
surface reads. Column types are SQLite-native; JSON columns are TEXT holding a JSON array.

**publisher** — the crawl targets + Ströer flag.
```
id TEXT PK · domain TEXT · sales_house TEXT? · is_stroeer INTEGER(0|1) · section_urls TEXT(json)
```
7 rows. `is_stroeer=1` marks the Ströer portfolio (currently only `t-online.de`). Everything
else (spiegel.de, focus.de, heise.de, zeit.de, rp-online.de, auto-motor-und-sport.de) is a
competitor.

**crawl_run** — one crawl of one publisher.
```
id TEXT PK · publisher_id TEXT · profile TEXT · started_at TEXT · status TEXT · pages INTEGER
· finished_at TEXT? · bytes_downloaded INTEGER
```
16 rows. The graph reads the **latest run per publisher** (`MAX(started_at)`).

**observation** — one ad slot seen on one page during one run. The capture fact.
```
id INTEGER PK · crawl_run_id TEXT · ts TEXT · page_url TEXT · slot_id TEXT · ad_system TEXT
· gam_advertiser_id TEXT? · gam_campaign_id TEXT? · gam_creative_id TEXT? · creative_hash TEXT?
· clickthrough_raw TEXT? · screenshot_blob TEXT?(sha256) · markup_blob TEXT?(sha256)
· payload_blob TEXT?(sha256) · is_empty INTEGER(0|1) · source_key TEXT
```
80 rows. `is_empty=1` = the slot rendered nothing (backfill/passback/house — a real coverage
signal, kept as first-class). Blob columns hold sha256 hashes into the blob store (§6).

**creative** — a distinct creative (by content hash), with its resolved brand.
```
creative_hash TEXT PK · first_seen TEXT · last_seen TEXT · phash TEXT? · embedding BLOB?
· assets TEXT(json) · clickthrough_raw TEXT? · landing_domain TEXT? · brand_id TEXT? · ocr_text TEXT?
```
65 rows. `brand_id` links to `brand` — set by the enrichment loop (§4 of the enrichment doc).
After the 6-Sep enrichment run, 29 creatives have a `brand_id`.

**brand** — the advertiser aggregate. The cross-publisher identity.
```
id TEXT PK(uuid) · name TEXT · parent TEXT? · landing_domains TEXT(json array) · vertical TEXT?
· cm360_networks TEXT(json array) · status TEXT('auto'|'review'|'verified')
```
21 rows after enrichment (Leica, Deutsche Bahn, Smava, OTTO, TeamViewer, Canon, Adobe, KfW,
Geely, Pudu Robotics, …). `status='auto'` = machine-derived, unverified. Domain lookup uses
`json_each(landing_domains)`.

**Empty today (0 rows) but must exist for the trigger read query to run:**
- **campaign** `id PK · brand_id · first_seen · last_seen · creative_hashes(json) · publishers(json) · ad_systems(json) · campaign_type?`
- **event** `id PK · ts · type · campaign_id · publisher_id? · score REAL? · evidence TEXT(json)` — an event of `type` NEW/… is a **trigger**.
- **campaign_agency** `campaign_id PK · brand_id · agency_id? · agency_name · status · evidence(json) · resolved_at`
- **agency** `id PK · name · status`

These are produced by the campaigns/insight contexts (the pipeline), which have not run on the
current data — so **`list_triggers` returns empty until that layer runs.** The graph tools
(`ad_graph`, `brand_timeline`, `list_publishers`) work fully on current data. Be honest about
this in the kit; do not fake triggers.

---

## 4. The read surface (what becomes kit tools)

Source of truth: `src/contexts/presentation/infrastructure/sqlite-dashboard-store.ts` and
`src/contexts/presentation/ports.ts`. These are **already the exact shape a kit tool wants** —
pure reads returning plain view models. Port the SQL nearly verbatim (SQLite → libSQL is
compatible; `json_each`, CTEs, joins all supported).

| Read method | Kit tool | Returns | Works on current data? |
|---|---|---|---|
| `listTriggers()` | `list_triggers` | ranked `TriggerView[]` (re-checks liveness at read) | **No** — needs `event` rows |
| `findTrigger(id)` | `get_trigger` | one `TriggerView` + evidence + timeline | No — needs `event` rows |
| `graphSliceAll(limit)` | `ad_graph` (overview) | `AdGraphObservationRow[]` → `buildAdGraph()` | **Yes** |
| `graphSlice({publisher,limit})` | `ad_graph` (focus) | same, one publisher's latest run | Yes |
| `graphPublishers()` | `list_publishers` | `{domain, isStroeer}[]` | Yes |
| `brandTimeline(brandId)` | `brand_timeline` | `{observationId, observedAt, publisher, event}[]` | Yes |

### 4.1 The graph query (the heart of Stage A)

`graphSliceAll` = "latest run per publisher, unioned; each observation left-joined to its
creative and brand." The exact SQL is in `sqlite-dashboard-store.ts` lines ~100-124. It returns
rows shaped as `AdGraphObservationRow` (see `ad-graph.ts`), which feed the pure builder.

### 4.2 `buildAdGraph()` — the pure view-model builder

Source: `src/contexts/presentation/domain/ad-graph.ts` (pure, no I/O). **Copy this file into the
kit verbatim** (its only dependency is `redactSensitiveTokens` from
`src/shared/kernel/scrub-identifiers.ts` — copy that function too). It:
- Builds a layered graph: `publisher → page → slot → advertiser → campaign → creative → brand`
  (overview mode collapses page/slot so buyers are the subject).
- Computes **reach** per buyer identity: distinct publishers + whether any is Ströer.
- Marks `notOnStroeer` on creative/brand nodes seen on ≥1 competitor and NO Ströer publisher.
- Emits `stats`: `crossPublisher` (buyer on ≥2 publishers) and `notOnStroeer` (buyer on ≥1
  competitor, no Ströer) — **these two numbers are the pitch.**

### 4.3 What the current data yields (verified 6 Sep 2026)

- 12 brands surface in the dashboard's latest-run slice: **10 not-on-Ströer opportunities**, 2
  on Ströer (Tchibo, Pudu Robotics on t-online.de).
- Across ALL runs, one genuine cross-publisher opportunity: **Deutsche Bahn on focus.de +
  spiegel.de, neither Ströer** — the real version of the product's core trigger.

---

## 5. `TriggerView` shape (for when the event layer exists)

From `src/contexts/presentation/ports.ts`. The kit's `list_triggers`/`get_trigger` return this.
`listTriggers` re-checks liveness at read time (a trigger only shows if its campaign is still
live and coverage is complete), then sorts by score desc.

```ts
interface TriggerView {
  id: string; campaignId: string; eventType: 'NEW' | ...;
  brandId: string; brandName: string;
  agencyName: string;               // 'Unknown' if unresolved
  agencyStatus: 'resolved' | 'unknown' | ...;
  score: number; scoreComponents: Record<string, number>;
  live: { lastObservedAt: string; windowDays: number; coverageComplete: true };
  publishers: string[];             // competitor publishers the campaign runs on
  evidence: { label: string; href: string; kind: 'screenshot'|'markup'|'payload' }[];
  timeline: TriggerTimelineEntry[];
}
```

The evidence `href` is `/blob/<sha256>` — a blob-store route (§6). In Stage A there is no blob
server, so evidence links will not resolve; that is fine and expected (mark it).

---

## 6. Blob store (screenshots + ad markup)

Content-addressed local store (adint ADR-0003). Layout:
`data/blobs/sha256/<key[0:2]>/<key[2:4]>/<key>` + a `metadata.json` mapping key → mediaType.
Source: `src/shared/blob/blob-store.ts` (`FileSystemBlobStore`). Screenshots are PNG, markup is
HTML, slot-payload is JSON. **Stage A does not need blob content** — the graph/evidence only
carry blob *hashes*. The blob store becomes a KitStack storage/object adapter in Stage B.

Note: blobs are scrubbed on write — JSON payloads pass through `scrubIdentifiers` (removes
consent/cookie/device keys). The markup blobs are where the real advertiser is recoverable (the
enrichment loop reads them — see the enrichment doc), because captured clickthroughs are almost
all expired ad-tech redirectors (the T-0067 problem, §8).

---

## 7. Privacy invariant (ADR-0009) — carry it into the kit

No user identifiers ever leave the system: consent strings (TCF/GPP), cookies, device IDs, IPs.
The graph builder runs `redactSensitiveTokens` over every label/meta value as defense-in-depth
before the JSON leaves the domain. **Keep that call when porting** — the kit is a new surface,
same rule. `scrub-identifiers.ts` also has `findSensitiveTokens` (the compliance gate) if the
kit ever needs to assert cleanliness.

---

## 8. Known gotchas (so the coding agent doesn't rediscover them)

- **Captured clickthroughs are junk.** ~All `clickthrough_raw` values are expired Google/Doubleclick
  redirectors (`aclk`, `pcs/click`), `whythisad`, or ad-tech infra (outbrain, ampproject,
  fonts.googleapis). Enriching them yields "Doubleclick"/"Outbrain", not the advertiser. The
  **real advertiser is recoverable from the ad markup blob** (e.g. a Leica landing URL was in
  the markup while the clickthrough was empty). Fixing capture-time resolution is adint ticket
  T-0067 — the linchpin. For the kit, brands come from the enrichment loop over markup +
  screenshots, not from clickthroughs.
- **`list_triggers` is empty on current data** (no `event` rows). The graph is the opportunity
  view for Stage A. Don't fake events.
- **Two adint DBs exist**: `data/adint.sqlite` (the real one, 65 creatives, 21 brands) and
  `.adint/adint.sqlite` (near-empty). Seed the kit from **`data/adint.sqlite`**.
- **Advertiser/campaign IDs never cross publishers** — only creative-hash and brand-id do. The
  stats code already restricts the cross-publisher signal to those two identities.
- **SQLite dialect**: adint uses better-sqlite3 (sync); KitStack uses libSQL (async). Same SQL,
  but kit tool reads are `await`ed. Port raw SQL via drizzle's `sql` template + `db.all(...)`.

---

## 9. How Stage A maps onto KitStack (summary)

- `schema.ts` — Drizzle tables mirroring §3 (read-relevant columns). The schema migration is
  **generated by drizzle-kit from schema.ts at `kitstack build`** (do not hand-write it);
  `migrations/9999_seed.sql` — data dumped from `data/adint.sqlite` (publisher, crawl_run,
  observation, creative, brand; the 4 trigger tables ship empty). **Gotcha:** the migration
  runner splits on `;` naively (build.ts:163, dev-db.ts:57), even inside string values AND
  comments — so the seed URL-encodes `;`→`%3B` in values and keeps `;` out of comment lines.
  That naive split is a real platform limitation adint surfaced (see the dogfood ticket).
- `src/domain/ad-graph.ts` + `src/domain/scrub.ts` — copied pure code.
- `src/domain/read-model.ts` — the ported raw-SQL reads (graphSliceAll/graphSlice/graphPublishers/
  brandTimeline/listTriggers/findTrigger).
- `src/tools/*.ts` — the five tools, thin wrappers over the read model + `buildAdGraph`.
- `src/views/*` — chat-host graph / triggers / trigger_detail (draft in Stage A).

Everything above is buildable now. Stage B (enrichment agent, connectors, capture job, storage
adapter, grant paywall) rides the platform primitives — see the spec §6 and the requirements
matrix §4.
