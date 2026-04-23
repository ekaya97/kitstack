import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { skills, kits, reviews } from "./schema";
import { seedSkills, seedKits, seedReviews } from "./seed-data";

async function seed() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client);

  console.log(`Seeding ${seedSkills.length} skills...`);
  for (const skill of seedSkills) {
    await db
      .insert(skills)
      .values(skill)
      .onConflictDoUpdate({
        target: skills.slug,
        set: {
          name: skill.name,
          category: skill.category,
          description: skill.description,
          upgradeHook: skill.upgradeHook,
          tags: skill.tags,
          compatibility: skill.compatibility,
          exampleInput: skill.exampleInput,
          exampleOutput: skill.exampleOutput,
          whatsInside: skill.whatsInside,
          composition: skill.composition,
          s3Key: skill.s3Key,
          author: skill.author,
          fileSize: skill.fileSize,
          correspondingKitSlug: skill.correspondingKitSlug,
          avgRating: skill.avgRating,
          reviewCount: skill.reviewCount,
          downloadCount: skill.downloadCount,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`Seeding ${seedKits.length} kits...`);
  for (const kit of seedKits) {
    await db
      .insert(kits)
      .values(kit)
      .onConflictDoUpdate({
        target: kits.slug,
        set: {
          name: kit.name,
          category: kit.category,
          description: kit.description,
          correspondingSkillSlug: kit.correspondingSkillSlug,
          replaces: kit.replaces,
          savingsPerMonth: kit.savingsPerMonth,
          dbSchema: kit.dbSchema,
          mcpTools: kit.mcpTools,
          mcpApps: kit.mcpApps,
          tagline: kit.tagline,
          author: kit.author,
          status: kit.status,
          subscriberCount: kit.subscriberCount,
          avgRating: kit.avgRating,
          reviewCount: kit.reviewCount,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`Seeding ${seedReviews.length} reviews...`);
  for (const review of seedReviews) {
    await db
      .insert(reviews)
      .values(review)
      .onConflictDoNothing();
  }

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
