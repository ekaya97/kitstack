import { defineLoader } from "../../sdk";
import { pipelineDashboard } from "../../tools/pipeline-dashboard";

export const loader = defineLoader(async (db, ctx) => {
  return pipelineDashboard.load(db, {}, ctx);
});
