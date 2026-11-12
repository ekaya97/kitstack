# Fressnapf Kit — Spec

Prototype MCP app on kitstack. Purpose: a 30-second video that gets forwarded. Not a product.

## 1. Constraints that shape everything

- **The video is the deliverable.** Every tool and view exists to produce one clean, continuous conversation on screen. Anything not in the script is cut.
- **Deterministic on camera.** All storefront calls go through a fixture layer. The recording runs 100 % from cache. Live adapter only used to *build* the cache.
- **Mock orders only.** `place_order` never touches fressnapf.de checkout. Confirmation is generated locally.
- **Looks like a Fressnapf app, branded enka.** Product data, images and prices are real (public storefront). Store availability and Friends points are mocked and labelled as such in the footer of the view, small.
- **First API-based plugin for kitstack.** The storefront adapter is the plugin boundary, so this doubles as the plugin-type reference implementation.

## 2. Architecture

```
ChatGPT / Claude
   │  MCP (tools + UI resources)
   ▼
kitstack kit: fressnapf
   ├── tools/        (MCP tool handlers, thin)
   ├── views/        (MCP Apps UI resources)
   ├── domain/       (basket, pet profile, order — in-memory, per session)
   └── plugin: storefront (the API plugin)
         ├── StorefrontAdapter  (interface)
         ├── FixtureAdapter     (JSON on disk — used for recording)
         ├── HttpAdapter        (fressnapf.de JSON endpoints, if present)
         └── PlaywrightAdapter  (fallback, headless, scrapes listing + PDP)
```

### StorefrontAdapter interface

```ts
interface StorefrontAdapter {
  search(q: SearchQuery): Promise<ProductSummary[]>
  getProduct(id: string): Promise<Product>
  getReviews(id: string, limit?: number): Promise<Review[]>
  // availability is NOT on the adapter — it is mocked in domain/
}

type SearchQuery = {
  text: string
  category?: 'hund' | 'katze' | 'kleintier' | 'vogel' | 'aquaristik' | 'terraristik'
  filters?: {
    species?: string        // "hund"
    breedSize?: 'klein' | 'mittel' | 'groß'
    lifeStage?: 'welpe' | 'adult' | 'senior'
    foodType?: 'trocken' | 'nass' | 'snack' | 'kauartikel'
    grainFree?: boolean
    priceMax?: number
    brand?: string[]
  }
  limit?: number            // default 6, hard cap 12
}
```

Before writing PlaywrightAdapter: open fressnapf.de with DevTools, search "hundefutter", look for a JSON XHR behind the listing. Third-party scrapers advertise "via the Fressnapf API", so one likely exists. If it does, HttpAdapter is 50 lines and Playwright is only needed for PDP/reviews. Either way, the recording runs on FixtureAdapter.

### Fixture strategy

- `fixtures/search/<hash-of-query>.json`
- `fixtures/product/<id>.json`
- `fixtures/reviews/<id>.json`
- Record mode: every adapter call writes through to fixtures. Replay mode: adapter reads fixtures, throws on miss (so a missed query is caught in rehearsal, not on camera).
- Pre-record exactly the queries in the script (section 6) plus 2–3 variants in case you improvise.

## 3. Data model

```ts
type ProductSummary = {
  id: string                 // fressnapf article number
  name: string
  brand: string
  price: { amount: number; currency: 'EUR'; perKg?: number }
  image: string              // absolute URL
  rating?: { value: number; count: number }
  url: string                // PDP on fressnapf.de
  badges?: string[]          // "Bestseller", "Angebot"
  attributes: Partial<{
    species: string; breedSize: string; lifeStage: string
    foodType: string; grainFree: boolean; weight: string
  }>
}

type Product = ProductSummary & {
  description: string        // trimmed to ~600 chars
  bullets: string[]          // "Produktvorteile"
  composition?: string       // Zusammensetzung
  analytics?: string         // Analytische Bestandteile
  variants?: { id: string; label: string; price: number }[]
}

type Review = { rating: number; title?: string; text: string; date: string; author?: string }

type PetProfile = {
  name: string; species: 'hund' | 'katze'; breed?: string
  ageYears?: number; weightKg?: number
  needs?: string[]           // "Zahnpflege", "Gelenke", "sensible Verdauung"
}

type BasketLine = { productId: string; qty: number; unitPrice: number; name: string; image: string }
type Basket = { lines: BasketLine[]; subtotal: number; friendsPoints: number; store?: Store }

type Store = { id: string; name: string; address: string; pickupToday: boolean }  // mocked
type Order = { id: string; basket: Basket; store: Store; pickupWindow: string; createdAt: string }
```

## 4. Tools

Keep descriptions short and in German — the model reads them, and the transcript is German. Tools return structured content plus a `view` hint.

| Tool | Input | Output → View | Notes |
|---|---|---|---|
| `pet_profile_set` | PetProfile | profile → **pet_card** | Called once at the top of the script. Anchors the whole demo. |
| `pet_profile_get` | — | profile | Lets the model reason with breed/needs on later turns. |
| `search_products` | SearchQuery | ProductSummary[] → **product_list** | Model derives filters from the pet profile (Scottish Terrier → `breedSize: klein`, `lifeStage: adult`). |
| `get_product` | id | Product + top 3 reviews → **product_detail** | Single call for detail + reviews to keep the turn count low. |
| `get_reviews` | id, limit | Review[] → **reviews** | Optional; only if the script needs a reviews-only beat. |
| `store_availability` | productIds[], plz | {productId, store, inStock}[] | **Mocked.** Always returns the Krefeld store with `inStock: true` for fixture products. |
| `basket_add` | productId, qty | Basket → **basket** | Recomputes Friends points (mock: 1 point per €). |
| `basket_remove` | productId | Basket → **basket** | |
| `basket_get` | — | Basket → **basket** | |
| `place_order` | store, pickupWindow | Order → **order_confirmation** | Mock. Generates `FN-2026-XXXXXX`. Never calls the storefront. |

Tool description conventions:
- One sentence what it does, one sentence when to use it. No parameter prose — the schema carries it.
- `search_products`: "Sucht Produkte im Fressnapf-Sortiment. Nutze das Tierprofil, um Filter (Größe, Alter, Futterart) zu setzen, bevor du suchst."
- `place_order`: "Löst eine Abholbestellung im Markt aus. Nur nach ausdrücklicher Bestätigung des Nutzers."

## 5. Views (MCP Apps UI resources)

All views: German copy, Fressnapf-adjacent but not Fressnapf-branded (no logo, no wordmark — their green is fine as an accent). Small footer on mocked views: "Prototyp — Verfügbarkeit und Friends-Punkte simuliert".

**pet_card** — compact card: name, breed, age, needs as chips. Sits at the top of the conversation and is the single biggest "this is an app" signal.

**product_list** — 3–6 product cards in a horizontal scroll or 2-col grid: image, brand, name, price (+ per-kg), rating stars, one attribute chip row (e.g. "Kleine Rassen · Adult · Getreidefrei"). Each card has "Details" and "In den Korb". Clicks fire tool calls via the host bridge (`get_product`, `basket_add`).

**product_detail** — hero image, name, price, variants as pills, bullets, collapsible Zusammensetzung, then 3 reviews with stars. Primary button "In den Korb", secondary "Zurück zur Liste".

**basket** — line items with qty steppers, subtotal, "Friends-Punkte: +42", store row ("Abholung: Fressnapf Krefeld, heute ab 16:00"), primary "Zur Abholung bestellen".

**order_confirmation** — order number, store, pickup window, line items, "Bruno freut sich." The frame the video ends on. Make it pretty; it is the last thing the forwarder sees.

Sizing: views must read at the width ChatGPT renders inline (~700px) and at mobile width if you record on phone. Record desktop.

## 6. Demo script (single conversation, ~30 s of screen time, cut to pace)

1. **User:** "Ich hab einen Scottish Terrier, Bruno, 4 Jahre. Was ist das beste Trockenfutter für ihn?"
   → `pet_profile_set` → **pet_card** → `search_products` (breedSize klein, adult, trocken) → **product_list** (4 cards)
   → Model: two sentences why #1 and #2 fit (small kibble, protein level, terrier tendency to dental issues). No essay.
2. **User:** "Nimm das zweite."
   → `basket_add` → **basket**
   → Model: "Scottish Terrier neigen zu Zahnstein — soll ich einen Zahnpflege-Kauartikel dazulegen?" (This is the beat that shows reasoning. Dental, not bone health.)
3. **User:** "Ja, zeig mir einen."
   → `search_products` (kauartikel, zahnpflege, klein) → **product_list** (3 cards) → user taps "Details" on one → **product_detail** with reviews → "In den Korb" → **basket** (Friends points update)
4. **User:** "Abholen in Krefeld."
   → `store_availability` → `place_order` → **order_confirmation**

Cut points: 0–8 s question + list, 8–16 s dental suggestion + detail view with reviews, 16–26 s basket + pickup, 26–30 s confirmation frame with caption: **"Prototyp · 3 Tage · Sortiment live von fressnapf.de · enka"**.

Pre-record fixtures for: step-1 search, step-3 search, PDP + reviews of the chosen chew, PDP of product #2 (in case you click it), and one alternative first query ("Futter für kleinen Hund, Zahnpflege") as a safety net.

## 7. Build order (3 days)

**Day 1 — data.** DevTools on fressnapf.de → decide Http vs Playwright. Write adapter + fixture record/replay. Record the script's fixtures. Normalise attributes (breedSize/lifeStage/foodType) from category breadcrumbs and PDP facts; hand-fix the 8 fixture products if extraction is ugly — nobody will know.

**Day 2 — kit.** Tools, domain (basket, profile, order, mock store), tool descriptions. Test the four-step script in Claude and ChatGPT dev mode with plain text output. Fix filter derivation until step 1 reliably picks small-breed adult dry food.

**Day 3 — views + recording.** Five views, in the order pet_card → product_list → basket → order_confirmation → product_detail. Rehearse 5×. Record 3 takes. Cut to 30 s. Export 1080p, German captions off, end card on.

## 8. Prepared answers (they will ask)

- **"Scraped ihr unsere Seite?"** Prototyp: öffentliches Sortiment, gecacht. Produktion: Akeneo-PIM-Feed, Bestand aus SAP/EWM, Friends per OAuth. Kein Scraping in Produktion.
- **"Und der Checkout?"** Wie Carrefour: Warenkorb wird an fressnapf.de übergeben, Bezahlung bleibt im Shop. Kein Zahlungsverkehr im Assistenten.
- **"Warum ChatGPT *und* Claude?"** Ein MCP-Server, zwei Verzeichnisse. Der Kit läuft unverändert in beiden.
- **"Was ist mit Frag MIA?"** Anderes Ende des Ladens: MIA berät Mitarbeiter auf der Fläche, das hier holt den Kunden vor dem Einkauf ab. Beides sitzt auf denselben Produktdaten.

## 9. Out of scope (deliberately)

Real Friends login, real store availability, payment, multi-country, cat/other species beyond fixtures, personalisation from purchase history. Say so if asked; none of it changes the architecture.
