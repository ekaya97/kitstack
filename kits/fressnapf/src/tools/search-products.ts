import { z } from "zod";
import { defineTool, kit, type KitContext } from "@kitstackco/sdk";
import { products } from "../schema";
import { rowToProduct, filterProducts, type Product, type SearchQuery } from "../domain/product";
import { setLastSearch } from "../domain/ui-state";
import { eur } from "../domain/basket";

const searchProductsArgs = z.object({
  text: z.string().optional().describe("Freitext, z. B. 'Trockenfutter' oder 'Zahnpflege'"),
  category: z
    .enum(["hund", "katze", "kleintier", "vogel", "aquaristik", "terraristik"])
    .optional()
    .describe("Sortimentskategorie"),
  filters: z
    .object({
      species: z.string().optional().describe("Tierart, z. B. 'hund'"),
      breedSize: z.enum(["klein", "mittel", "groß"]).optional().describe("Rassengröße"),
      lifeStage: z.enum(["welpe", "adult", "senior"]).optional().describe("Lebensphase"),
      foodType: z
        .enum(["trocken", "nass", "snack", "kauartikel"])
        .optional()
        .describe("Futterart"),
      grainFree: z.boolean().optional().describe("Nur getreidefrei"),
      priceMax: z.number().optional().describe("Maximalpreis in EUR"),
      brand: z.array(z.string()).optional().describe("Nur diese Marken"),
    })
    .optional()
    .describe("Strukturierte Filter aus dem Tierprofil (Größe, Lebensphase, Futterart …)"),
  limit: z.number().optional().describe("Max. Treffer (Standard 6, max 12)"),
});

async function loadSearchProducts(ctx: KitContext, args: SearchQuery): Promise<Product[]> {
  const rows = await ctx.db.select().from(products);
  const all = rows.map(rowToProduct);
  const results = filterProducts(all, args);
  const label =
    args.text ||
    [args.filters?.breedSize, args.filters?.lifeStage, args.filters?.foodType]
      .filter(Boolean)
      .join(" · ") ||
    "Sortiment";
  await setLastSearch(ctx.db, ctx.identity.principal, results.map((p) => p.id), label);
  return results;
}

export const searchProducts = defineTool({
  name: "search_products",
  description:
    "Sucht Produkte im Fressnapf-Sortiment. Nutze das Tierprofil, um Filter (Größe, Alter, Futterart) zu setzen, bevor du suchst. Danach kit_view(id=\"fressnapf\", view=\"product_list\") aufrufen, um die Treffer als Karten zu zeigen.",
  args: searchProductsArgs,
  load: loadSearchProducts,
  handler: async (ctx, args) => {
    const results = await loadSearchProducts(ctx, args);
    if (results.length === 0)
      return kit.text("Keine Treffer. Lockere die Filter (z. B. Größe oder Futterart).");

    const lines = results.map((p, i) => {
      const breedLabel: Record<string, string> = {
        klein: "kleine Rassen",
        mittel: "mittlere Rassen",
        groß: "große Rassen",
      };
      const attrs = [
        p.attributes.breedSize && (breedLabel[p.attributes.breedSize] ?? p.attributes.breedSize),
        p.attributes.lifeStage,
        p.attributes.grainFree ? "getreidefrei" : null,
      ]
        .filter(Boolean)
        .join(", ");
      const rating = p.rating ? ` · ${p.rating.value.toFixed(1)}★ (${p.rating.count})` : "";
      return `${i + 1}. ${p.brand} — ${p.name} · ${eur(p.price.amount)}${rating}${attrs ? ` · ${attrs}` : ""}  [${p.id}]`;
    });
    return kit.text(
      `${results.length} Treffer:\n${lines.join("\n")}\n\nZeige sie mit kit_view(id="fressnapf", view="product_list"). Nenne dem Nutzer in 1–2 Sätzen, warum #1 und #2 passen.`
    );
  },
});

Object.assign(searchProducts, {
  mode: "assist" as const,
  classification: "internal",
  annotations: { readOnlyHint: true, destructiveHint: false },
});
