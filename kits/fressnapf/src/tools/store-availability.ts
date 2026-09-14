import { z } from "zod";
import { defineTool, kit } from "@kitstackco/sdk";
import { MOCK_STORE, PICKUP_WINDOW } from "../domain/store";

export const storeAvailability = defineTool({
  name: "store_availability",
  description:
    "Prüft die Verfügbarkeit zur Abholung im Markt. (Prototyp: simuliert — immer Fressnapf Krefeld, sofort abholbereit.)",
  args: z.object({
    product_ids: z.array(z.string()).describe("Artikelnummern"),
    plz: z.string().optional().describe("Postleitzahl des Nutzers"),
  }),
  handler: async (_db, args) => {
    const rows = args.product_ids.map((id) => ({
      productId: id,
      store: MOCK_STORE.name,
      inStock: true,
    }));
    return kit.text(
      `Verfügbar im ${MOCK_STORE.name} (${MOCK_STORE.address}) — Abholung ${PICKUP_WINDOW}.\n${rows
        .map((r) => `- ${r.productId}: auf Lager`)
        .join("\n")}\n\n(Prototyp: Verfügbarkeit simuliert.)`
    );
  },
});
