import { createElement } from "react";
import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader.js";
import { TriggersView } from "./View.js";

export default defineView({
  id: "triggers",
  name: "Opportunities",
  description: "after list_triggers — the ranked 'call this agency' opportunities",
  loaders: [loader],
  render: (data, host) => createElement(TriggersView, { data, host }),
  height: 480,
  placeholder: [],
});
