import { z } from "zod";
import { defineTool, kit, type KitContext } from "@kitstackco/sdk";
import { withToolMetadata } from "../tool-metadata";
import { graphPublishers, type GraphPublisherOption } from "../domain/read-model.js";

async function loadPublishers(ctx: KitContext): Promise<GraphPublisherOption[]> {
  return graphPublishers(ctx.db);
}

export const listPublishers = withToolMetadata(defineTool({
  name: "list_publishers",
  description:
    "List the publishers adint has captured ads on, and whether each is on the Ströer portfolio (is_stroeer) or a competitor.",
  args: z.object({}),
  load: (ctx, _a) => loadPublishers(ctx),
  handler: async (ctx, _a) => {
    const rows = await loadPublishers(ctx);
    if (rows.length === 0) return kit.text("No publishers captured yet.");
    const stroeer = rows.filter((r) => r.isStroeer).map((r) => r.domain);
    const competitors = rows.filter((r) => !r.isStroeer).map((r) => r.domain);
    return kit.text(
      [
        `Publishers captured: ${rows.length}`,
        `Ströer portfolio: ${stroeer.length ? stroeer.join(", ") : "—"}`,
        `Competitors: ${competitors.length ? competitors.join(", ") : "—"}`,
      ].join("\n")
    );
  },
}), "assist", "internal");
