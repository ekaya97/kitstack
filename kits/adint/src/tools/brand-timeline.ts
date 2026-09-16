import { z } from "zod";
import { defineTool, kit, type KitContext } from "@kitstackco/sdk";
import { withToolMetadata } from "../tool-metadata";
import { brandTimeline, type TriggerTimelineEntry } from "../domain/read-model.js";

const args = z.object({
  brandId: z.string().describe("The brand id (uuid) — from an ad_graph brand node's meta.brandId."),
});

async function loadTimeline(ctx: KitContext, a: z.infer<typeof args>): Promise<TriggerTimelineEntry[]> {
  return brandTimeline(ctx.db, a.brandId);
}

export const brandTimelineTool = withToolMetadata(defineTool({
  name: "brand_timeline",
  description:
    "Show where and when a brand's ads were observed, across publishers. Use the brandId from an ad_graph brand node (its meta.brandId).",
  args,
  load: (ctx, a: z.infer<typeof args>) => loadTimeline(ctx, a),
  handler: async (ctx, a) => {
    const rows = await loadTimeline(ctx, a);
    if (rows.length === 0) return kit.text(`No observations for brand ${a.brandId}.`);
    const byPublisher = new Map<string, number>();
    for (const r of rows) byPublisher.set(r.publisher, (byPublisher.get(r.publisher) ?? 0) + 1);
    const spread = [...byPublisher.entries()].map(([p, n]) => `${p} (${n})`).join(", ");
    return kit.text(
      [
        `${rows.length} observations across ${byPublisher.size} publisher(s): ${spread}`,
        `First: ${rows[0]?.observedAt} · Last: ${rows[rows.length - 1]?.observedAt}`,
      ].join("\n")
    );
  },
}), "assist", "internal");
