import { z } from "zod";
import { defineTool, kit, type KitContext } from "@kitstackco/sdk";
import { withToolMetadata } from "../tool-metadata";
import { findTrigger, type TriggerView } from "../domain/read-model.js";

const args = z.object({
  id: z.string().describe("The trigger/event id, from list_triggers."),
});

async function loadTrigger(ctx: KitContext, a: z.infer<typeof args>): Promise<TriggerView | null> {
  return findTrigger(ctx.db, a.id);
}

export const getTrigger = withToolMetadata(defineTool({
  name: "get_trigger",
  description:
    "Get one opportunity in full: the brand, the competitor publishers it runs on, the resolved agency, the score breakdown, and evidence. Then call kit_view(id=\"adint\", view=\"trigger-detail\").",
  args,
  load: (ctx, a: z.infer<typeof args>) => loadTrigger(ctx, a),
  handler: async (ctx, a) => {
    const t = await loadTrigger(ctx, a);
    if (t === null) return kit.text(`No live trigger with id ${a.id}.`);
    const components = Object.entries(t.scoreComponents)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    return kit.text(
      [
        `${t.brandName} — call ${t.agencyName} (${t.agencyStatus})`,
        `Score ${t.score.toFixed(2)}${components ? ` (${components})` : ""}`,
        `Running on: ${t.publishers.join(", ")}`,
        `Live since last observed ${t.live.lastObservedAt} (window ${t.live.windowDays}d)`,
        `Evidence: ${t.evidence.length} item(s).`,
        `\nShow it with kit_view(id="adint", view="trigger-detail"). To act, hand this to the debrief kit's initiate_call.`,
      ].join("\n")
    );
  },
}), "assist", "internal");
