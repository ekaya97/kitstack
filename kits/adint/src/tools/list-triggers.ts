import { z } from "zod";
import { defineTool, kit, type KitContext } from "@kitstackco/sdk";
import { withToolMetadata } from "../tool-metadata";
import { listTriggers, type TriggerView } from "../domain/read-model.js";

async function loadTriggers(ctx: KitContext): Promise<TriggerView[]> {
  return listTriggers(ctx.db);
}

export const listTriggersTool = withToolMetadata(defineTool({
  name: "list_triggers",
  description:
    "List ranked 'call this agency' opportunities: a brand on a live campaign running on competitors, not on Ströer. Then call kit_view(id=\"adint\", view=\"triggers\").",
  args: z.object({}),
  load: (ctx, _a) => loadTriggers(ctx),
  handler: async (ctx, _a) => {
    const triggers = await loadTriggers(ctx);
    if (triggers.length === 0) {
      // Honest Stage-A state: triggers are produced by the campaigns/insight pipeline, which has
      // not run on the seeded data. The graph is the opportunity view meanwhile.
      return kit.text(
        "No scored triggers yet — the campaign/insight layer has not run on this data. Use ad_graph to see brands running on competitors but not on Ströer (the same opportunity, unscored)."
      );
    }
    const lines = triggers
      .slice(0, 20)
      .map((t, i) => `${i + 1}. ${t.brandName} — agency: ${t.agencyName} · score ${t.score.toFixed(2)} · on ${t.publishers.join(", ")}`);
    return kit.text(
      `${triggers.length} live opportunities:\n${lines.join("\n")}\n\nShow them with kit_view(id="adint", view="triggers").`
    );
  },
}), "assist", "internal");
