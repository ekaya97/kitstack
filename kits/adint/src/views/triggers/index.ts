import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader.js";
import { TriggersView } from "./View.js";

export default defineView({
  slug: "triggers",
  name: "Opportunities",
  description: "after list_triggers — the ranked 'call this agency' opportunities",
  loader,
  component: TriggersView,
  height: 480,
  placeholder: [],
});
