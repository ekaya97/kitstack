import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { withToolMetadata } from "../tool-metadata";
import { nanoid } from "nanoid";
import { products, basketLines } from "../schema";
import { buildBasket, eur } from "../domain/basket";

export const basketAdd = withToolMetadata(defineTool({
  name: "basket_add",
  description:
    "Legt ein Produkt in den Warenkorb. Danach kit_view(id=\"fressnapf\", view=\"basket\") aufrufen, um den Korb zu zeigen.",
  args: z.object({
    product_id: z.string().describe("Fressnapf-Artikelnummer"),
    qty: z.number().optional().default(1).describe("Menge (Standard 1)"),
  }),
  handler: async (ctx, args) => {
    const prod = await ctx.db.select().from(products).where(eq(products.id, args.product_id)).limit(1);
    if (!prod[0]) return kit.notFound("Produkt", args.product_id);
    const p = prod[0];
    const now = new Date().toISOString();
    const qty = args.qty ?? 1;

    const existing = await db
      .select()
      .from(basketLines)
      .where(and(eq(basketLines.userId, ctx.identity.principal), eq(basketLines.productId, p.id)))
      .limit(1);

    let id: string;
    if (existing[0]) {
      id = existing[0].id;
      await db
        .update(basketLines)
        .set({ qty: existing[0].qty + qty, updatedAt: now })
        .where(eq(basketLines.id, id));
    } else {
      id = `bl_${nanoid()}`;
      await ctx.db.insert(basketLines).values({
        id,
        userId: ctx.identity.principal,
        productId: p.id,
        qty,
        unitPrice: p.priceAmount,
        name: p.name,
        image: p.image,
        createdAt: now,
        updatedAt: now,
      });
    }

    const rows = await ctx.db.select().from(basketLines).where(eq(basketLines.userId, ctx.identity.principal));
    const basket = buildBasket(rows);
    return kit.result(
      kit.updated(
        id,
        "basket",
        `${p.name} im Korb. Zwischensumme ${eur(basket.subtotal)}, +${basket.friendsPoints} Friends-Punkte. Zeige den Korb mit kit_view(id="fressnapf", view="basket").`
      )
    );
  },
}), "act", "sensitive");
