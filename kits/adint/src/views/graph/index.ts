import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader.js";
import { GraphView } from "./View.js";

export default defineView({
  slug: "graph",
  name: "Ad graph",
  description: "after ad_graph — the cross-publisher graph and the not-on-Ströer opportunities",
  loader,
  component: GraphView,
  height: 560,
  placeholder: {
    nodes: [
      { id: "brand:1", type: "brand", label: "Deutsche Bahn", layer: 6, reach: 2, notOnStroeer: true, meta: { brandId: "1", name: "Deutsche Bahn" }, evidence: [] },
      { id: "brand:2", type: "brand", label: "Smava", layer: 6, reach: 1, notOnStroeer: true, meta: { brandId: "2", name: "Smava" }, evidence: [] },
      { id: "brand:3", type: "brand", label: "Tchibo", layer: 6, reach: 1, stroeer: true, meta: { brandId: "3", name: "Tchibo" }, evidence: [] },
    ],
    edges: [],
    stats: {
      publishers: 5,
      pages: 0,
      slots: 80,
      filledSlots: 44,
      emptySlots: 36,
      fillRate: 0.55,
      advertisers: 13,
      campaigns: 0,
      creatives: 44,
      creativesWithBrand: 12,
      crossPublisher: 1,
      notOnStroeer: 10,
    },
    truncated: false,
  },
});
