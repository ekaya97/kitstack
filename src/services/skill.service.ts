import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { skills } from "@/db/schema";
import type { Skill } from "@/db/schema";
import { toSkillCard, type SkillCardData } from "./transformers";

export async function getAllSkills(): Promise<Skill[]> {
  return db.select().from(skills).orderBy(skills.name);
}

export async function getSkillsByCategory(category: string): Promise<Skill[]> {
  return db
    .select()
    .from(skills)
    .where(eq(skills.category, category as Skill["category"]))
    .orderBy(skills.name);
}

export async function getSkillBySlug(slug: string): Promise<Skill | undefined> {
  const results = await db
    .select()
    .from(skills)
    .where(eq(skills.slug, slug))
    .limit(1);
  return results[0];
}

export async function incrementDownloadCount(slug: string): Promise<void> {
  await db
    .update(skills)
    .set({ downloadCount: sql`${skills.downloadCount} + 1` })
    .where(eq(skills.slug, slug));
}

export async function getAllSkillCards(): Promise<SkillCardData[]> {
  const allSkills = await getAllSkills();
  return allSkills.map(toSkillCard);
}

export async function getSkillCardBySlug(slug: string): Promise<SkillCardData | null> {
  const skill = await getSkillBySlug(slug);
  return skill ? toSkillCard(skill) : null;
}
