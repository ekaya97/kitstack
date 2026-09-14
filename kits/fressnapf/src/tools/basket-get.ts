import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { basketLines } from "../schema";
import { buildBasket, eur } from "../domain/basket";

export const basketGet = defineTool({
  name: "basket_get",
  description: "Zeigt den aktuellen Warenkorb (Positionen, Zwischensumme, Friends-Punkte).",
  args: z.object({}),
  load: async (db, _args, ctx) => {
    const rows = await db.select().from(basketLines).where(eq(basketLines.userId, ctx.userId));
    return buildBasket(rows);
  },
  handler: async (db, args, ctx) => {
    const basket = await basketGet.load(db, args, ctx);
    if (basket.lines.length === 0) return kit.text("Der Warenkorb ist leer.");
    const lines = basket.lines
      .map((l) => `- ${l.qty}× ${l.name} — ${eur(l.lineTotal)}`)
      .join("\n");
    return kit.text(
      `Warenkorb:\n${lines}\n\nZwischensumme: ${eur(basket.subtotal)} · +${basket.friendsPoints} Friends-Punkte`
    );
  },
});
