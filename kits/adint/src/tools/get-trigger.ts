import { z } from "zod";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "@kitstackco/sdk";
import { findTrigger, type TriggerView } from "../domain/read-model.js";

const args = z.object({
  id: z.string().describe("The trigger/event id, from list_triggers."),
});

async function loadTrigger(db: LibSQLDatabase, a: z.infer<typeof args>): Promise<TriggerView | null> {
  return findTrigger(db, a.id);
}

export const getTrigger = defineTool({
  name: "get_trigger",
  description:
    "Get one opportunity in full: the brand, the competitor publishers it runs on, the resolved agency, the score breakdown, and evidence. Then call kit_view(id=\"adint\", view=\"trigger-detail\").",
  args,
  load: (db, a: z.infer<typeof args>, _ctx) => loadTrigger(db, a),
  handler: async (db, a, _ctx) => {
    const t = await loadTrigger(db, a);
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
});
