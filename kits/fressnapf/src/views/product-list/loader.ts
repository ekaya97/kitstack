import { defineLoader } from "@kitstackco/sdk";
import { inArray } from "drizzle-orm";
import { products } from "../../schema";
import { rowToProduct } from "../../domain/product";
import { getUiState } from "../../domain/ui-state";

export const loader = defineLoader(async (db, ctx) => {
  const ui = await getUiState(db, ctx.userId);
  const ids: string[] = ui?.lastSearchIds ? JSON.parse(ui.lastSearchIds) : [];
  if (ids.length === 0) return { label: ui?.lastSearchLabel ?? "", products: [] };

  const rows = await db.select().from(products).where(inArray(products.id, ids));
  const byId = new Map(rows.map((r) => [r.id, rowToProduct(r)]));
  const ordered = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);

  return { label: ui?.lastSearchLabel ?? "", products: ordered };
});
