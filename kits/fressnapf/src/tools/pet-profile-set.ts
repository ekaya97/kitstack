import { z } from "zod";
import { eq } from "drizzle-orm";
import { defineTool, kit } from "@kitstackco/sdk";
import { nanoid } from "nanoid";
import { petProfile } from "../schema";

export const petProfileSet = defineTool({
  name: "pet_profile_set",
  description:
    "Legt das Tierprofil an oder aktualisiert es (Name, Art, Rasse, Alter, Bedürfnisse). Am Anfang des Gesprächs aufrufen — es verankert alle folgenden Empfehlungen.",
  args: z.object({
    name: z.string().describe("Name des Tieres, z. B. 'Bruno'"),
    species: z.enum(["hund", "katze"]).describe("Tierart"),
    breed: z.string().optional().describe("Rasse, z. B. 'Scottish Terrier'"),
    age_years: z.number().optional().describe("Alter in Jahren"),
    weight_kg: z.number().optional().describe("Gewicht in kg"),
    needs: z
      .array(z.string())
      .optional()
      .describe("Besondere Bedürfnisse, z. B. ['Zahnpflege', 'sensible Verdauung']"),
  }),
  load: async (db, args, ctx) => {
    const now = new Date().toISOString();
    const existing = await db
      .select()
      .from(petProfile)
      .where(eq(petProfile.userId, ctx.userId))
      .limit(1);

    const values = {
      userId: ctx.userId,
      name: args.name,
      species: args.species,
      breed: args.breed ?? null,
      ageYears: args.age_years ?? null,
      weightKg: args.weight_kg ?? null,
      needs: args.needs ? JSON.stringify(args.needs) : null,
      updatedAt: now,
    };

    let id: string;
    if (existing[0]) {
      id = existing[0].id;
      await db.update(petProfile).set(values).where(eq(petProfile.id, id));
    } else {
      id = `pet_${nanoid()}`;
      await db.insert(petProfile).values({ ...values, id, createdAt: now });
    }
    return { id, ...args };
  },
  handler: async (db, args, ctx) => {
    const { id } = await petProfileSet.load(db, args, ctx);
    const desc = [args.breed, args.age_years ? `${args.age_years} Jahre` : null]
      .filter(Boolean)
      .join(", ");
    return kit.result(
      kit.created(id, "pet_profile", `Profil für ${args.name}${desc ? ` (${desc})` : ""} gespeichert.`)
    );
  },
});
