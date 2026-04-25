import { defineLoader } from "../../sdk";
import { listExpenses } from "../../tools/list-expenses";

export const loader = defineLoader(async (db, ctx) => {
  return listExpenses.load(db, { limit: 100 }, ctx);
});
