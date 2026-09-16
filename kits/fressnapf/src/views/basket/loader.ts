import { defineLoader } from "@kitstackco/sdk";
import { basketGet } from "../../tools/basket-get";

export const loader = defineLoader(async (ctx) => {
  return basketGet.load(ctx, {});
});
