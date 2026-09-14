import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { petProfile } from "../schema";

export const petProfileGet = defineTool({
  name: "pet_profile_get",
  description:
    "Liest das gespeicherte Tierprofil. Nutze es, um mit Rasse/Alter/Bedürfnissen zu argumentieren, bevor du Produkte empfiehlst.",
  args: z.object({}),
  load: async (db, _args, ctx) => {
    const rows = await db
      .select()
      .from(petProfile)
      .where(eq(petProfile.userId, ctx.userId))
      .limit(1);
    const p = rows[0];
    if (!p) return null;
    return {
      name: p.name,
      species: p.species,
      breed: p.breed,
      ageYears: p.ageYears,
      weightKg: p.weightKg,
      needs: p.needs ? (JSON.parse(p.needs) as string[]) : [],
    };
  },
  handler: async (db, args, ctx) => {
    const p = await petProfileGet.load(db, args, ctx);
    if (!p) return kit.text("Noch kein Tierprofil hinterlegt. Frag nach Name, Rasse und Alter.");
    return kit.json(p);
  },
});
