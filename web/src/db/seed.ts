import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { skills, kits } from "./schema";
import { seedSkills, seedKits } from "./seed-data";
import { log, flushLogs } from "@/lib/logger";

async function seed() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:databases/local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client);

  log.info("Seeding skills", { count: seedSkills.length });
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

  log.info("Seeding kits", { count: seedKits.length });
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

  log.info("Seed complete");
  await flushLogs();
  process.exit(0);
}

seed().catch(async (err) => {
  log.error("Seed failed", { error: err.message });
  await flushLogs();
  process.exit(1);
});
