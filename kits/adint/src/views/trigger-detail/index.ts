import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader.js";
import { TriggerDetailView } from "./View.js";

export default defineView({
  slug: "trigger-detail",
  name: "Opportunity detail",
  description: "after get_trigger — one opportunity: agency, score breakdown, evidence",
  loader,
  component: TriggerDetailView,
  height: 520,
});
