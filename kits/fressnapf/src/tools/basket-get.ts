import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit, type KitContext } from "@kitstackco/sdk";
import { basketLines } from "../schema";
import { buildBasket, eur } from "../domain/basket";

const basketArgs = z.object({});

async function loadBasket(ctx: KitContext, _args: z.infer<typeof basketArgs>) {
  const rows = await ctx.db.select().from(basketLines).where(eq(basketLines.userId, ctx.identity.principal));
  return buildBasket(rows);
}

export const basketGet = defineTool({
  name: "basket_get",
  description: "Zeigt den aktuellen Warenkorb (Positionen, Zwischensumme, Friends-Punkte).",
  args: basketArgs,
  load: loadBasket,
  handler: async (ctx, args) => {
    const basket = await loadBasket(ctx, args);
    if (basket.lines.length === 0) return kit.text("Der Warenkorb ist leer.");
    const lines = basket.lines
      .map((l) => `- ${l.qty}× ${l.name} — ${eur(l.lineTotal)}`)
      .join("\n");
    return kit.text(
      `Warenkorb:\n${lines}\n\nZwischensumme: ${eur(basket.subtotal)} · +${basket.friendsPoints} Friends-Punkte`
    );
  },
});

Object.assign(basketGet, {
  mode: "assist" as const,
  classification: "sensitive",
  annotations: { readOnlyHint: true, destructiveHint: false },
});
