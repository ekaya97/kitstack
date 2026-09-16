import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { products, reviews } from "../schema";
import { rowToProduct } from "../domain/product";
import { setCurrentProduct } from "../domain/ui-state";
import { eur } from "../domain/basket";

export const getProduct = defineTool({
  name: "get_product",
  description:
    "Holt Produktdetails inkl. der 3 besten Bewertungen. Danach kit_view(id=\"fressnapf\", view=\"product_detail\") aufrufen, um die Detailansicht zu zeigen.",
  args: z.object({
    id: z.string().describe("Fressnapf-Artikelnummer (aus search_products)"),
  }),
  load: async (ctx, args) => {
    const rows = await ctx.db.select().from(products).where(eq(products.id, args.id)).limit(1);
    if (!rows[0]) return null;
    const product = rowToProduct(rows[0]);
    const topReviews = await ctx.db
      .select()
      .from(reviews)
      .where(eq(reviews.productId, args.id))
      .orderBy(desc(reviews.rating), desc(reviews.date))
      .limit(3);
    await setCurrentProduct(ctx.db, ctx.identity.principal, args.id);
    return {
      product,
      reviews: topReviews.map((r) => ({
        rating: r.rating,
        title: r.title,
        text: r.text,
        date: r.date,
        author: r.author,
      })),
    };
  },
  handler: async (ctx, args) => {
    const data = await getProduct.load(ctx, args);
    if (!data) return kit.notFound("Produkt", args.id);
    const { product: p, reviews: revs } = data;
    const rating = p.rating ? `${p.rating.value.toFixed(1)}★ (${p.rating.count})` : "keine Bewertung";
    const revLines = revs.length
      ? revs.map((r) => `- ${r.rating}★ ${r.title ? `„${r.title}" ` : ""}${r.text}`).join("\n")
      : "Noch keine Bewertungen.";
    return kit.text(
      `${p.brand} — ${p.name}\n${eur(p.price.amount)}${p.price.perKg ? ` (${eur(p.price.perKg)}/kg)` : ""} · ${rating}\n\n${p.description ?? ""}\n\nTop-Bewertungen:\n${revLines}\n\nZeige die Detailansicht mit kit_view(id="fressnapf", view="product_detail").`
    );
  },
});

Object.assign(getProduct, {
  mode: "assist" as const,
  classification: "internal",
  annotations: { readOnlyHint: true, destructiveHint: false },
});
