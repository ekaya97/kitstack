import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Catalog — seeded from the public Fressnapf storefront (see migrations/0001_seed.sql).
 * In the seed-now prototype this table is populated by a migration. Later it will be
 * refreshed by a `sync_storefront` defineJob (blocked on T-0111), with tools reading
 * this table unchanged — the storefront adapter is the plugin boundary.
 *
 * `id` is the real Fressnapf article number (natural key). Prices/ratings/attributes
 * are hand-set for the prototype; names, images and URLs are the real public data.
 */
export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(), // Fressnapf article number
    name: text("name").notNull(),
    brand: text("brand").notNull(),
    priceAmount: real("price_amount").notNull(),
    currency: text("currency").notNull().default("EUR"),
    pricePerKg: real("price_per_kg"),
    image: text("image").notNull(),
    url: text("url").notNull(),
    ratingValue: real("rating_value"),
    ratingCount: integer("rating_count"),
    category: text("category"), // "hund" | "katze" | ...
    species: text("species"),
    breedSize: text("breed_size"), // "klein" | "mittel" | "groß"
    lifeStage: text("life_stage"), // "welpe" | "adult" | "senior"
    foodType: text("food_type"), // "trocken" | "nass" | "snack" | "kauartikel"
    grainFree: integer("grain_free").default(0),
    weight: text("weight"),
    badges: text("badges"), // JSON array of strings
    description: text("description"),
    bullets: text("bullets"), // JSON array of strings
    composition: text("composition"),
    analytics: text("analytics"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_products_species").on(t.species),
    index("idx_products_food_type").on(t.foodType),
    index("idx_products_breed_size").on(t.breedSize),
  ]
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    rating: integer("rating").notNull(),
    title: text("title"),
    text: text("text").notNull(),
    date: text("date").notNull(),
    author: text("author"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_reviews_product").on(t.productId)]
);

/** One pet profile per user — anchors the whole conversation. */
export const petProfile = sqliteTable(
  "pet_profile",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    species: text("species").notNull(), // "hund" | "katze"
    breed: text("breed"),
    ageYears: real("age_years"),
    weightKg: real("weight_kg"),
    needs: text("needs"), // JSON array of strings
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_pet_profile_user").on(t.userId)]
);

/** Basket lines — one row per (user, product). */
export const basketLines = sqliteTable(
  "basket_lines",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    qty: integer("qty").notNull().default(1),
    unitPrice: real("unit_price").notNull(),
    name: text("name").notNull(),
    image: text("image").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_basket_user").on(t.userId)]
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(), // FN-2026-XXXXXX
    userId: text("user_id").notNull(),
    store: text("store").notNull(), // JSON
    pickupWindow: text("pickup_window").notNull(),
    subtotal: real("subtotal").notNull(),
    friendsPoints: integer("friends_points").notNull().default(0),
    lines: text("lines").notNull(), // JSON snapshot of basket lines
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_orders_user").on(t.userId)]
);

/**
 * Per-user UI state. View loaders receive no free-form params, so parameterized
 * views (product_list = last search, product_detail = one product) read "what to
 * show" from here. Tools write it as a side effect.
 */
export const uiState = sqliteTable("ui_state", {
  userId: text("user_id").primaryKey(),
  lastSearchIds: text("last_search_ids"), // JSON array of product ids
  lastSearchLabel: text("last_search_label"),
  currentProductId: text("current_product_id"),
  updatedAt: text("updated_at").notNull(),
});

export const schema = { products, reviews, petProfile, basketLines, orders, uiState };
