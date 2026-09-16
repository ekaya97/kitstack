import { defineLoader } from "@kitstackco/sdk";
import { getProduct } from "../../tools/get-product";
import { getUiState } from "../../domain/ui-state";

export const loader = defineLoader(async (ctx) => {
  const ui = await getUiState(ctx.db, ctx.identity.principal);
  if (!ui?.currentProductId) return null;
  return getProduct.load(ctx, { id: ui.currentProductId });
});
