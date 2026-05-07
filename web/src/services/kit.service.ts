import { eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kits, kitRegistryTable } from "@/db/schema";
import { user as userTable } from "@/db/auth-schema";
import type { Kit } from "@/db/schema";
import { toKitCard, type KitCardData } from "./transformers";

export async function getAllKits(): Promise<Kit[]> {
  return db.select().from(kits).orderBy(kits.name);
}

/**
 * Get kits visible to a user: public kits + their own private kits.
 * Public = author is "kitstack". Private = author is a userId.
 */
export async function getKitsForUser(userId: string | null): Promise<Kit[]> {
  if (!userId) {
    return db.select().from(kits).where(eq(kits.author, "kitstack")).orderBy(kits.name);
  }
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

/**
 * Check if a kit is accessible to a user.
 * Public kits (author = "kitstack") are accessible to everyone.
 * Private kits are only accessible to their author.
 */
export function isKitAccessible(kit: Kit, userId: string | null): boolean {
  if (kit.author === "kitstack") return true;
  return kit.author === userId;
}

/**
 * Check if a kit is private (authored by a developer, not system).
 */
export function isPrivateKit(kit: Kit): boolean {
  return kit.author !== "kitstack";
}

/**
 * Resolve the display name for a kit author.
 * System kits show "kitstack", private kits resolve userId to user name.
 */
export async function resolveAuthorName(authorId: string): Promise<string> {
  if (authorId === "kitstack") return "kitstack";
  const [row] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, authorId))
    .limit(1);
  return row?.name || "Developer";
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
