import { eq, sql } from "drizzle-orm";
import { skills } from "@/db/schema";
import type { Skill } from "@/db/schema";

export async function getAllSkills(db: any): Promise<Skill[]> {
  return db.select().from(skills).orderBy(skills.name);
}

export async function getSkillsByCategory(db: any, category: string): Promise<Skill[]> {
  return db
    .select()
    .from(skills)
    .where(eq(skills.category, category as Skill["category"]))
    .orderBy(skills.name);
}

export async function getSkillBySlug(db: any, slug: string): Promise<Skill | undefined> {
  const results = await db
    .select()
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1);
  return results[0];
}

export async function incrementDownloadCount(db: any, slug: string): Promise<void> {
  await db
    .update(skills)
    .set({ downloadCount: sql`${skills.downloadCount} + 1` })
    .where(eq(skills.slug, slug));
}
