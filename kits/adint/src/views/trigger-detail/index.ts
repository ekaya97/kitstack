import { createElement } from "react";
import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader.js";
import { TriggerDetailView } from "./View.js";

export default defineView({
  id: "trigger-detail",
  name: "Opportunity detail",
  description: "after get_trigger — one opportunity: agency, score breakdown, evidence",
  loaders: [loader],
  render: (data, host) => createElement(TriggerDetailView, { data, host }),
  height: 520,
});
