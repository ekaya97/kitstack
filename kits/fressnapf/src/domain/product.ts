import type { InferSelectModel } from "drizzle-orm";
import type { products } from "../schema";

export type ProductRow = InferSelectModel<typeof products>;

/** Shape the views and tool text consume — JSON columns parsed, booleans real. */
export type Product = {
  id: string;
  name: string;
  brand: string;
  price: { amount: number; currency: string; perKg: number | null };
  image: string;
  url: string;
  rating: { value: number; count: number } | null;
  badges: string[];
  attributes: {
    species: string | null;
    breedSize: string | null;
    lifeStage: string | null;
    foodType: string | null;
    grainFree: boolean;
    weight: string | null;
  };
  description: string | null;
  bullets: string[];
  composition: string | null;
  analytics: string | null;
};

function parseJsonArray(v: string | null): string[] {
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    price: { amount: r.priceAmount, currency: r.currency, perKg: r.pricePerKg ?? null },
    image: r.image,
    url: r.url,
    rating: r.ratingValue != null ? { value: r.ratingValue, count: r.ratingCount ?? 0 } : null,
    badges: parseJsonArray(r.badges),
    attributes: {
      species: r.species,
      breedSize: r.breedSize,
      lifeStage: r.lifeStage,
      foodType: r.foodType,
      grainFree: r.grainFree === 1,
      weight: r.weight,
    },
    description: r.description,
    bullets: parseJsonArray(r.bullets),
    composition: r.composition,
    analytics: r.analytics,
  };
}

// ─── Search ──────────────────────────────────────────────────

export type SearchQuery = {
  text?: string;
  category?: string;
  filters?: {
    species?: string;
    breedSize?: string;
    lifeStage?: string;
    foodType?: string;
    grainFree?: boolean;
    priceMax?: number;
    brand?: string[];
  };
  limit?: number;
};

const STOP = new Set([
  "der", "die", "das", "ein", "eine", "und", "oder", "für", "fuer", "mit", "beste",
  "bestes", "beste", "gut", "gute", "hund", "hunde", "futter", "hundefutter", "was",
  "ist", "den", "dem", "meinen", "meinem",
]);

/**
 * Filter + rank the catalog. Structured filters are strict; free `text` only
 * boosts ranking (never zeroes out a filtered result on camera) — unless there
 * are no structured filters, in which case text becomes the filter.
 */
export function filterProducts(products: Product[], q: SearchQuery): Product[] {
  const f = q.filters ?? {};
  const hasStructured =
    !!q.category ||
    !!f.species ||
    !!f.breedSize ||
    !!f.lifeStage ||
    !!f.foodType ||
    f.grainFree === true ||
    f.priceMax != null ||
    (f.brand?.length ?? 0) > 0;

  let rows = products.filter((p) => {
    if (q.category && p.attributes.species !== q.category && p.attributes.species !== q.category)
      return false;
    if (f.species && p.attributes.species !== f.species) return false;
    if (f.breedSize && p.attributes.breedSize !== f.breedSize) return false;
    if (f.lifeStage && p.attributes.lifeStage !== f.lifeStage) return false;
    if (f.foodType && p.attributes.foodType !== f.foodType) return false;
    if (f.grainFree === true && !p.attributes.grainFree) return false;
    if (f.priceMax != null && p.price.amount > f.priceMax) return false;
    if (f.brand?.length) {
      const brands = f.brand.map((b) => b.toLowerCase());
      if (!brands.includes(p.brand.toLowerCase())) return false;
    }
    return true;
  });

  const tokens = (q.text ?? "")
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/)
    .filter((t) => t.length >= 4 && !STOP.has(t));

  const score = (p: Product): number => {
    if (!tokens.length) return 0;
    const blob = [
      p.name, p.brand, p.attributes.foodType, p.attributes.breedSize,
      p.attributes.lifeStage, p.description, p.badges.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return tokens.reduce((n, t) => n + (blob.includes(t) ? 1 : 0), 0);
  };

  // Text-only search: require a token hit so we don't return the whole catalog.
  if (!hasStructured && tokens.length) {
    rows = rows.filter((p) => score(p) > 0);
  }

  rows.sort((a, b) => {
    const s = score(b) - score(a);
    if (s !== 0) return s;
    const r = (b.rating?.value ?? 0) - (a.rating?.value ?? 0);
    if (r !== 0) return r;
    return (b.rating?.count ?? 0) - (a.rating?.count ?? 0);
  });

  const limit = Math.min(Math.max(q.limit ?? 6, 1), 12);
  return rows.slice(0, limit);
}
