import { defineLoader } from "../../sdk";
import { listProposals } from "../../tools/list-proposals";

export const loader = defineLoader(async (db, ctx) => {
  return listProposals.load(db, {}, ctx);
});
