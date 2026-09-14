import { z } from "zod";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "@kitstackco/sdk";
import { graphPublishers, type GraphPublisherOption } from "../domain/read-model.js";

async function loadPublishers(db: LibSQLDatabase): Promise<GraphPublisherOption[]> {
  return graphPublishers(db);
}

export const listPublishers = defineTool({
  name: "list_publishers",
  description:
    "List the publishers adint has captured ads on, and whether each is on the Ströer portfolio (is_stroeer) or a competitor.",
  args: z.object({}),
  load: (db, _a, _ctx) => loadPublishers(db),
  handler: async (db, _a, _ctx) => {
    const rows = await loadPublishers(db);
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
});
