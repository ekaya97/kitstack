# adint — Ad Intelligence Kit (Stage A)

Ad-intelligence for Ströer: **which brands advertise on our competitors but not on us, and which
agency to call.** The cross-publisher ad graph + "call this agency" opportunities, exposed as MCP
tools + chat views over a seeded snapshot from the standalone adint product (`~/dev/adint`).

**Read these first (full context, written by the porting session):**
- `.track/specs/adint-kit-spec.md` — the kit design + the dogfooding requirements matrix
- `.track/docs/adint-domain-reference.md` — the data model, read queries, graph algorithm, gotchas
- `.track/docs/adint-brand-enrichment.md` — the enrichment loop = the `defineAgent` proof + instructions

## What Stage A is

The **read surface only**, over a labelled kit-local store (the seeded snapshot). No missing
primitives — buildable and runnable today. The capture pipeline, enrichment agent, connectors,
grants paywall, and the real shared store are **Stage B** (they ride the platform spine — spec §6).

## Surface

Tools: `ad_graph`, `list_publishers`, `brand_timeline`, `list_triggers`, `get_trigger`.
Views: `graph`, `triggers`, `trigger-detail` (chat host; **draft inline styling** — restyle with
the SDK `ks-*` tokens).

Demo: ask "who is advertising against us?" → `ad_graph` → the `graph` view shows the
not-on-Ströer opportunities. Hand a lead to the debrief kit's `initiate_call` to act on it.

## Honest limitations (Stage A)

- **`list_triggers` / `get_trigger` return empty** — the campaigns/insight pipeline that writes
  `event` rows has not run on this snapshot. The `ad_graph` is the opportunity view meanwhile.
  Do not fake triggers.
- **Brands are machine-derived** (`status='auto'`), not verified.
- **Evidence `/blob/<hash>` links do not resolve** — no blob server in Stage A.
- **The store is a labelled shortcut** (the seeded snapshot), not the future shared storage
  adapter. Do not mistake it for the storage boundary (spec §1, §6; the Fressnapf lesson).

## What the seed contains

Real captured + enriched data dumped from `~/dev/adint/data/adint.sqlite` on 2026-09-06:
7 publishers (t-online.de = Ströer), 16 crawl runs, 80 observations, 65 creatives, **21 brands,
29 creative→brand links** (Leica, Deutsche Bahn, Smava, OTTO, TeamViewer, Canon, …). Regenerate
per `.track/docs/adint-domain-reference.md` §9.

## Run

```bash
npm install
npm run dev     # kitstack dev --stdio
```

Data-layer tests belong in `test/` via `createTestKit` against `migrations/` (schema + seed).

## Provenance

Ported by the adint↔kitstack dogfooding session. adint decision record:
`~/dev/adint/docs/adr/0019-adint-as-kitstack-kit.md`. Tracking: kitstack ticket T-0122.
