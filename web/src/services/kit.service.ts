import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { kits } from "@/db/schema";
import type { Kit } from "@/db/schema";
import { toKitCard, type KitCardData } from "./transformers";

export async function getAllKits(): Promise<Kit[]> {
  return db.select().from(kits).orderBy(kits.name);
}

export async function getKitsForUser(userId: string | null): Promise<Kit[]> {
  if (!userId) {
    // Public kits only (author = "kitstack")
    return db.select().from(kits).where(eq(kits.author, "kitstack")).orderBy(kits.name);
  }
  // Public kits + user's private kits
  return db
    .select()
    .from(kits)
    .where(or(eq(kits.author, "kitstack"), eq(kits.author, userId)))
    .orderBy(kits.name);
}

export async function getKitsByCategory(category: string): Promise<Kit[]> {
  return db
    .select()
    .from(kits)
    .where(eq(kits.category, category as Kit["category"]))
    .orderBy(kits.name);
}

export async function getKitBySlug(slug: string): Promise<Kit | undefined> {
  const results = await db
    .select()
    .from(kits)
    .where(eq(kits.slug, slug))
    .limit(1);
  return results[0];
}

export async function getAllKitCards(): Promise<KitCardData[]> {
  const allKits = await getAllKits();
  return allKits.map(toKitCard);
}

export async function getKitCardsForUser(userId: string | null): Promise<KitCardData[]> {
  const userKits = await getKitsForUser(userId);
  return userKits.map(toKitCard);
}

export async function getKitCardBySlug(slug: string): Promise<KitCardData | null> {
  const kit = await getKitBySlug(slug);
  return kit ? toKitCard(kit) : null;
}
