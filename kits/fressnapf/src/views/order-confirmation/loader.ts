import { defineLoader } from "@kitstackco/sdk";
import { eq, desc } from "drizzle-orm";
import { orders, petProfile } from "../../schema";

export const loader = defineLoader(async (ctx) => {
  const rows = await ctx.db
    .select()
    .from(orders)
    .where(eq(orders.userId, ctx.identity.principal))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  const o = rows[0];
  if (!o) return null;

  const pet = await ctx.db
    .select({ name: petProfile.name })
    .from(petProfile)
    .where(eq(petProfile.userId, ctx.identity.principal))
    .limit(1);

  return {
    id: o.id,
    store: JSON.parse(o.store) as { name: string; address: string },
    pickupWindow: o.pickupWindow,
    subtotal: o.subtotal,
    friendsPoints: o.friendsPoints,
    lines: JSON.parse(o.lines) as { name: string; qty: number; lineTotal: number; image: string }[],
    petName: pet[0]?.name ?? null,
  };
});
