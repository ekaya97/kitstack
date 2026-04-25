import { defineLoader } from "../../sdk";
import { getProposalsWithDeals } from "../../queries/proposals";

export const loader = defineLoader(async (db, ctx) => {
  return getProposalsWithDeals(db);
});
