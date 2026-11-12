# adint — Brand Enrichment (the `defineAgent` proof + instructions)

**Written 6 September 2026.** How adint turns a captured creative into an advertiser brand, and
why that loop is the first concrete customer for KitStack's `defineAgent` primitive (roadmap
§9). Pairs with `adint-domain-reference.md` and `.track/specs/adint-kit-spec.md`.

---

## 1. The problem

A captured ad gives us: a **screenshot** (PNG), the ad **markup** (HTML), a slot **payload**
(JSON), GAM ids, and a `clickthrough_raw`. We need the **advertiser brand** (name, parent,
vertical, landing domain) — because the brand is the only identity that crosses publishers and
therefore the only thing that produces the "not on Ströer" signal.

The naive path — resolve the clickthrough to a landing domain, derive the brand — **fails on
real data**: almost every captured clickthrough is an expired Google/Doubleclick redirector or
ad-tech infra (see domain-reference §8). Enriching those yields "Doubleclick", "Outbrain",
"Ampproject" — noise, not advertisers.

**The real advertiser is in the screenshot and the markup.** The ad visual shows the brand; the
markup often embeds the true destination URL even when the clickthrough is a dead redirector
(e.g. a `leica-camera.com` URL sat in the markup while `clickthrough_raw` was empty).

So enrichment is a **vision + text** task: look at the creative, read the brand, corroborate
with markup-derived domains, ignore publisher/ad-house noise.

---

## 2. What we did (6 Sep 2026) — the manual run

We ran the enrichment loop **by hand with four Claude subagents**, no API key, no pipeline
wiring — a live proof that the loop works and that a Claude agent is the right engine for it.

- Exported 44 distinct creatives (43 with screenshots) from `data/adint.sqlite` + their
  markup-candidate domains.
- 4 subagents, each handling ~11 creatives: read the screenshot image, identified the
  advertiser, wrote structured JSON.
- Result: **29 confident identifications across 21 distinct brands** (Leica, Deutsche Bahn,
  Smava, OTTO ×4, TeamViewer ×3, Tchibo, Netto, Canon, Adobe, KfW, Geely, Pudu Robotics,
  Amazon, Afilio, Blåkläder, Günstig Heizen, Verkaufe Dein Wohnmobil, 80s80s Radio,
  Deutsche Unternehmerbörse, Heimundgarten24, Low-Code Association). **15 house-ads / blank
  slots correctly rejected.** No low-confidence guesses.
- Persisted: 21 `brand` rows (`status='auto'`), 29 `creative.brand_id` links. This is the data
  now seeded into the kit.

**This manual pass IS `defineAgent`:**
```ts
defineAgent({
  id: "brand-enricher",
  trigger: onNewCreatives,        // capture-complete or schedule
  model: "auto",                  // a strong vision model for the read
  instructions,                   // §4 below → SKILL.md
  tools: [read_creative_blob, write_brand],   // one kit, one trigger (roadmap §9.2 holds)
});
```
When `defineAgent` v1 exists, adint is its **non-voice** first integration test (the debrief
voice loop is specialized and latency-bound — roadmap §9.3).

---

## 3. Input contract for the loop (per creative)

What the agent needs for each creative (assembled at trigger time, loader-shaped — not fetched
mid-loop):
- `creative_hash`
- `screenshot` — the PNG blob (vision input)
- `markup_candidate_domains` — non-noise hostnames extracted from the markup/payload blobs
  (filter list below)
- context: `gam_advertiser_ids`, `seen_on_pages`

**Markup domain extraction filter** (drop these as never-the-advertiser):
`doubleclick, googleads, gstatic, googlesyndication, google.com, ampproject, googleapis,
googletagservices, googletagmanager, adssettings, 2mdn.net, w3.org, schema.org, googleadservices,
google-analytics, youtube.com, facebook.com, fonts.*, adnxs, criteo, nativendo.de, outbrain.com,
taboola, adform, adsafeprotected, moatads, clarium.io` and asset extensions
(`.gif/.js/.css/.svg/.png/.jpg`).

---

## 4. Instructions (the SKILL.md content — reuse verbatim)

This is the prompt that produced the run above. It is the authored guidance that belongs in a
`SKILL.md` next to the enrichment agent (roadmap §8.5). German-market specifics are load-bearing
— they are why the noise got filtered correctly.

> You identify the ADVERTISER (the brand whose product/service the ad promotes) in German
> display ads captured from news sites.
>
> For each creative: LOOK at the screenshot (primary signal — logo, product, headline, CTA).
> Use `markup_candidate_domains` only to corroborate.
>
> **These domains are NOT the advertiser — they are publishers, ad-sales houses, or infra:**
> - Publishers: focus.de, spiegel.de, t-online.de, zeit.de, heise.de, 80s80s.de, welt.de,
>   bild.de, faz.net, sueddeutsche.de
> - Ad-sales houses / ad-tech: burda-forward.de, iqdigital.de, ecoad.solutions, amazonaws.com,
>   cloudfront.net, clarium.io, nativendo.de
> A real advertiser domain is a brand's own site (leica-camera.com, smava.de, bahn.de,
> pudurobotics.com, verkaufe-dein-wohnmobil.de, guenstig-heizen.de).
>
> Output per creative (exactly these fields):
> - `advertiser_brand` (string|null) — cleanly formatted (e.g. "Leica", "Deutsche Bahn"); null if truly unknown
> - `parent_company` (string|null)
> - `vertical` (string|null) — short lowercase, e.g. consumer-electronics, automotive,
>   finance-loans, insurance, travel-rail, home-garden, robotics, retail, telecom, energy
> - `landing_domain` (string|null) — best real advertiser domain
> - `confidence` (0.0-1.0) — clear logo read ≈ 0.8-0.95; domain-only guess ≈ 0.4-0.6;
>   blank/unreadable/house-ad ≈ 0-0.2
> - `is_house_ad_or_noise` (bool) — true for the publisher's own house ad, a blank/near-empty
>   slot, or anything not a real third-party advertiser
> - `evidence` (string) — one sentence: what in the screenshot/markup led to the conclusion
>
> Be honest. Tiny/blank screenshot → low confidence, `is_house_ad_or_noise=true`. Never invent a
> brand unsupported by the image or a plausible domain.

---

## 5. Write path (what the agent's `write_brand` tool does)

Consistent with adint's `BrandMappingService` (`src/contexts/resolution/application/
brand-mapping.ts`) and `SqliteBrandRepository`:
- Dedupe by brand name (case-insensitive) → one `brand` row; union `landing_domains`.
- `status='auto'` (machine-derived, unverified — never `verified`).
- `cm360_networks='[]'`, `parent`/`vertical` from the enrichment.
- Set `creative.brand_id` (+ `creative.landing_domain`) for each enriched creative.

Only INSERT/UPDATE. (adint owner rule: no DROP in any SQL, ever.)

---

## 6. Eval (adint T-0070, when the loop is automated)

Full-chain (ad → advertiser) eval: a hand-labelled golden set, scored on advertiser-match /
vertical / confidence-calibration / cost / latency per provider. This becomes the release gate
for the enrichment agent and the dataset for KitStack's eval harness (roadmap §8.4). The 6-Sep
manual run (29 IDs, 15 correct rejections) is the first golden slice.
