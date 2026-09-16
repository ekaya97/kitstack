import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit, type KitContext } from "@kitstackco/sdk";
import { petProfile } from "../schema";

const petProfileGetArgs = z.object({});

async function loadPetProfile(ctx: KitContext, _args: z.infer<typeof petProfileGetArgs>) {
  const rows = await ctx.db
    .select()
    .from(petProfile)
    .where(eq(petProfile.userId, ctx.identity.principal))
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
}

export const petProfileGet = defineTool({
  name: "pet_profile_get",
  description:
    "Liest das gespeicherte Tierprofil. Nutze es, um mit Rasse/Alter/Bedürfnissen zu argumentieren, bevor du Produkte empfiehlst.",
  args: petProfileGetArgs,
  load: loadPetProfile,
  handler: async (ctx, args) => {
    const p = await loadPetProfile(ctx, args);
    if (!p) return kit.text("Noch kein Tierprofil hinterlegt. Frag nach Name, Rasse und Alter.");
    return kit.json(p);
  },
});

Object.assign(petProfileGet, {
  mode: "assist" as const,
  classification: "sensitive",
  annotations: { readOnlyHint: true, destructiveHint: false },
});
