import { createElement } from "react";
import type { ViewHost, ViewRender } from "@kitstackco/sdk";
import { GraphView } from "../../../../kits/adint/src/views/graph/View";
import { TriggersView } from "../../../../kits/adint/src/views/triggers/View";
import { TriggerDetailView } from "../../../../kits/adint/src/views/trigger-detail/View";

/**
 * The shell consumes a kit's public View renderers, not its loaders or storage.
 * Loader/API binding is deliberately a separate host concern; this first tenant
 * uses the same kind of honest seeded snapshot that the adint View previews use.
 */
export type ShellView = {
  id: string;
  name: string;
  description: string;
  height: number;
  data: unknown;
  render: ViewRender<unknown>;
};

const graphSnapshot = {
  nodes: [
    { id: "brand:db", type: "brand", label: "Deutsche Bahn", reach: 2, notOnStroeer: true, meta: { brandId: "brand-db", name: "Deutsche Bahn" } },
    { id: "brand:smava", type: "brand", label: "Smava", reach: 1, notOnStroeer: true, meta: { brandId: "brand-smava", name: "Smava" } },
    { id: "brand:tchibo", type: "brand", label: "Tchibo", reach: 1, stroeer: true, meta: { brandId: "brand-tchibo", name: "Tchibo" } },
  ],
  edges: [],
  stats: {
    publishers: 5,
    slots: 80,
    fillRate: 0.55,
    creativesWithBrand: 12,
    crossPublisher: 1,
    notOnStroeer: 10,
  },
  truncated: false,
};

const render = <T,>(component: React.ComponentType<{ data: T; host: ViewHost }>): ViewRender<unknown> =>
  (data, host) => createElement(component, { data: data as T, host });

/** Adint's first shell tenant. The host owns this registry; the kit owns each renderer. */
export const ADINT_VIEWS: readonly ShellView[] = [
  {
    id: "graph",
    name: "Ad graph",
    description: "Cross-publisher graph and brands not yet on Ströer.",
    height: 560,
    data: graphSnapshot,
    render: render(GraphView),
  },
  {
    id: "triggers",
    name: "Opportunities",
    description: "Ranked opportunities to call an agency.",
    height: 480,
    data: [],
    render: render(TriggersView),
  },
  {
    id: "trigger-detail",
    name: "Opportunity detail",
    description: "Agency, score breakdown, and evidence for one opportunity.",
    height: 520,
    data: null,
    render: render(TriggerDetailView),
  },
];

export function getAdintView(viewId: string): ShellView {
  return ADINT_VIEWS.find((view) => view.id === viewId) ?? ADINT_VIEWS[0];
}
