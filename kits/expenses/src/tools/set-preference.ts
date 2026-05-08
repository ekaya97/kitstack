import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { settings } from "../schema";

export const setPreference = defineTool({
  name: "set_preference",
  description: "Update a user setting — vat_mode (standard or kleinunternehmer), default_currency, or fiscal_year_start",
  args: z.object({
    key: z.enum(["vat_mode", "default_currency", "fiscal_year_start"]).describe("Setting key"),
    value: z.string().describe("Setting value (e.g. 'kleinunternehmer', 'EUR', '01')"),
  }),
  handler: async (db, args) => {
    const existing = await db.select().from(settings).where(eq(settings.key, args.key)).limit(1);

    if (existing.length > 0) {
      await db.update(settings).set({ value: args.value }).where(eq(settings.key, args.key));
    } else {
      await db.insert(settings).values({ key: args.key, value: args.value });
    }

    return kit.result(
      kit.updated(args.key, "setting", `Setting "${args.key}" set to "${args.value}".`)
    );
  },
});
