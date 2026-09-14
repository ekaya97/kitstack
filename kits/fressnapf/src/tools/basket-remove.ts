import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { basketLines } from "../schema";
import { buildBasket, eur } from "../domain/basket";

export const basketRemove = defineTool({
  name: "basket_remove",
  description:
    "Entfernt ein Produkt aus dem Warenkorb. Danach kit_view(id=\"fressnapf\", view=\"basket\") aufrufen.",
  args: z.object({
    product_id: z.string().describe("Fressnapf-Artikelnummer"),
  }),
  handler: async (db, args, ctx) => {
    const existing = await db
      .select()
      .from(basketLines)
      .where(and(eq(basketLines.userId, ctx.userId), eq(basketLines.productId, args.product_id)))
      .limit(1);
    if (!existing[0]) return kit.notFound("Warenkorb-Position", args.product_id);

    await db.delete(basketLines).where(eq(basketLines.id, existing[0].id));

    const rows = await db.select().from(basketLines).where(eq(basketLines.userId, ctx.userId));
    const basket = buildBasket(rows);
    return kit.result(
      kit.deleted(
        existing[0].id,
        "basket",
        `Entfernt. Zwischensumme ${eur(basket.subtotal)}, +${basket.friendsPoints} Friends-Punkte.`
      )
    );
  },
});
