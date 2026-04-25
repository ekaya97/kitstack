import { defineLoader } from "../../sdk";
import { listDeals } from "../../tools/list-deals";

export const loader = defineLoader(async (db, ctx) => {
  return listDeals.load(db, { limit: 100 }, ctx);
});
