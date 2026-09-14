import { defineLoader } from "@kitstackco/sdk";
import { basketGet } from "../../tools/basket-get";

export const loader = defineLoader(async (db, ctx) => {
  return basketGet.load(db, {}, ctx);
});
