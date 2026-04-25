import type { Skill, Kit } from "@/db/schema";

export interface SkillCardData {
  slug: string;
  name: string;
  cat: string;
  desc: string;
  files: number;
  size: string;
  upgradeTo: string | null;
  upgradeHook: string;
  author: string;
  downloads: number;
  rating: number;
  reviews: number;
}

export interface KitCardData {
  slug: string;
  name: string;
  cat: string;
  tagline: string;
  desc: string;
  replaces: string[];
  replacesValue: number;
  schema: string[];
  tools: string[];
  uiComponents: string[];
  fromSkill: string;
  author: string;
  subscribers: number;
  rating: number;
  reviews: number;
  status: string;
}

function mapCategory(category: string): string {
  return category === "Operations" ? "Ops" : category;
}

export function toSkillCard(skill: Skill): SkillCardData {
  return {
    slug: skill.slug,
    name: skill.name,
    cat: mapCategory(skill.category),
    desc: skill.description,
    files: skill.whatsInside?.length || 0,
    size: skill.fileSize || "",
    upgradeTo: skill.correspondingKitSlug ?? null,
    upgradeHook: skill.upgradeHook || "",
    author: skill.author || "kitstack",
    downloads: skill.downloadCount || 0,
    rating: skill.avgRating || 0,
    reviews: skill.reviewCount || 0,
  };
}

export function toKitCard(kit: Kit): KitCardData {
  const schemaNames = kit.dbSchema
    ? kit.dbSchema
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.includes(" ("))
        .map((line) => line.split(" (")[0])
    : [];

  return {
    slug: kit.slug,
    name: kit.name,
    cat: mapCategory(kit.category),
    tagline: kit.tagline || kit.description,
    desc: kit.description,
    replaces: kit.replaces ? kit.replaces.split(", ") : [],
    replacesValue: kit.savingsPerMonth,
    schema: schemaNames,
    tools: kit.mcpTools?.map((t) => t.name) || [],
    uiComponents: kit.mcpApps?.map((a) => a.name) || [],
    fromSkill: kit.correspondingSkillSlug || "",
    author: kit.author || "kitstack",
    subscribers: kit.subscriberCount || 0,
    rating: kit.avgRating || 0,
    reviews: kit.reviewCount || 0,
    status: kit.status || "live",
  };
}
