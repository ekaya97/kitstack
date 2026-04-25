import { defineLoader } from "../../sdk";
import { getDealsWithContacts } from "../../queries/deals";

export const loader = defineLoader(async (db, ctx) => {
  return getDealsWithContacts(db);
});
