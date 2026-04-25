import { defineLoader } from "../../sdk";
import { getPipelineSummary } from "../../queries/deals";

export const loader = defineLoader(async (db, ctx) => {
  return getPipelineSummary(db);
});
