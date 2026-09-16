import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { withToolMetadata } from "../tool-metadata";
import { customAlphabet } from "nanoid";
import { basketLines, orders } from "../schema";
import { buildBasket, eur } from "../domain/basket";
import { MOCK_STORE, PICKUP_WINDOW } from "../domain/store";

const orderNumber = customAlphabet("0123456789", 6);

export const placeOrder = withToolMetadata(defineTool({
  name: "place_order",
  description:
    "Löst eine Abholbestellung im Markt aus. Nur nach ausdrücklicher Bestätigung des Nutzers. Danach kit_view(id=\"fressnapf\", view=\"order_confirmation\") aufrufen. (Prototyp: Bestellung wird lokal erzeugt, kein echter Checkout.)",
  args: z.object({
    pickup_window: z
      .string()
      .optional()
      .describe(`Abholzeitfenster (Standard: '${PICKUP_WINDOW}')`),
  }),
  handler: async (ctx, args) => {
    const rows = await ctx.db.select().from(basketLines).where(eq(basketLines.userId, ctx.identity.principal));
    if (rows.length === 0)
      return kit.conflict("Der Warenkorb ist leer — erst etwas hinzufügen, dann bestellen.");

    const basket = buildBasket(rows);
    const id = `FN-2026-${orderNumber()}`;
    const now = new Date().toISOString();
    const pickupWindow = args.pickup_window ?? PICKUP_WINDOW;

    await ctx.db.insert(orders).values({
      id,
      userId: ctx.identity.principal,
      store: JSON.stringify(MOCK_STORE),
      pickupWindow,
      subtotal: basket.subtotal,
      friendsPoints: basket.friendsPoints,
      lines: JSON.stringify(basket.lines),
      createdAt: now,
    });

    return kit.result(
      kit.created(
        id,
        "order",
        `Abholbestellung ${id} bei ${MOCK_STORE.name}, ${pickupWindow}. Summe ${eur(basket.subtotal)}, +${basket.friendsPoints} Friends-Punkte. Zeige die Bestätigung mit kit_view(id="fressnapf", view="order_confirmation").`
      )
    );
  },
}), "act", "sensitive");
