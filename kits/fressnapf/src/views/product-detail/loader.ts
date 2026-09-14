import { defineLoader } from "@kitstackco/sdk";
import { getProduct } from "../../tools/get-product";
import { getUiState } from "../../domain/ui-state";

export const loader = defineLoader(async (db, ctx) => {
  const ui = await getUiState(db, ctx.userId);
  if (!ui?.currentProductId) return null;
  return getProduct.load(db, { id: ui.currentProductId }, ctx);
});
