import { z } from "zod";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "@kitstackco/sdk";
import { buildAdGraph, type AdGraphViewModel } from "../domain/ad-graph.js";
import { graphSlice } from "../domain/read-model.js";

/** Node cap per graph render (matches adint's graph limit). */
const NODE_LIMIT = 2000;

const args = z.object({
  publisher: z
    .string()
    .optional()
    .describe("Focus on one publisher domain (e.g. 'spiegel.de'). Omit for the cross-publisher overview."),
  limit: z.number().optional().describe("Max graph nodes (default 2000)."),
});

// Standalone loader (not the tool const) so the handler can reuse it without a type cycle.
async function loadGraph(db: LibSQLDatabase, a: z.infer<typeof args>): Promise<AdGraphViewModel> {
  const limit = a.limit ?? NODE_LIMIT;
  // Overview collapses page/slot so buyers (brands) are the subject; focus keeps detail.
  const collapsePages = a.publisher === undefined;
  const rows = await graphSlice(db, a.publisher, limit);
  return buildAdGraph({ rows, limit, collapsePages });
}

export const adGraph = defineTool({
  name: "ad_graph",
  description:
    "Build the cross-publisher ad graph: which brands run on which publishers, and which run on competitors but NOT on Ströer (the opportunity). Omit `publisher` for the overview. Then call kit_view(id=\"adint\", view=\"graph\").",
  args,
  load: (db, a: z.infer<typeof args>, _ctx) => loadGraph(db, a),
  handler: async (db, a, _ctx) => {
    const g = await loadGraph(db, a);
    const s = g.stats;
    if (s.slots === 0) return kit.text("No captured ad slots for this scope yet.");

    const opportunities = g.nodes
      .filter((n) => n.type === "brand" && n.notOnStroeer)
      .map((n) => `${n.label}${n.reach && n.reach >= 2 ? ` (on ${n.reach} publishers)` : ""}`)
      .sort();

    const scope = a.publisher ? `publisher ${a.publisher}` : "all publishers (latest run each)";
    const lines = [
      `Ad graph — ${scope}`,
      `Publishers: ${s.publishers} · slots: ${s.slots} (fill ${(s.fillRate * 100).toFixed(0)}%) · brands: ${s.creativesWithBrand}`,
      `**Not on Ströer (opportunities): ${s.notOnStroeer}** · cross-publisher (≥2): ${s.crossPublisher}`,
      opportunities.length > 0 ? `\nBrands running on competitors, not on Ströer:\n- ${opportunities.join("\n- ")}` : "",
      `\nShow it with kit_view(id="adint", view="graph").`,
      g.truncated ? "\n(Graph truncated at the node cap.)" : "",
    ];
    return kit.text(lines.filter(Boolean).join("\n"));
  },
});
