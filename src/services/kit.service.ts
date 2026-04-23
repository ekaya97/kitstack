import { eq } from "drizzle-orm";
import { kits } from "@/db/schema";
import type { Kit } from "@/db/schema";

export async function getAllKits(db: any): Promise<Kit[]> {
  return db.select().from(kits).orderBy(kits.name);
}

export async function getKitsByCategory(db: any, category: string): Promise<Kit[]> {
  return db
    .select()
    .from(kits)
    .where(eq(kits.category, category))
    .orderBy(kits.name);
}

export async function getKitBySlug(db: any, slug: string): Promise<Kit | undefined> {
  const results = await db
    .select()
    .from(kits)
    .where(eq(kits.slug, slug))
    .limit(1);
  return results[0];
}
