/**
 * Seed skills: upload zip packages to S3 and upsert metadata into Turso.
 *
 * Run: npx sst shell -- npx tsx scripts/seed-skills.ts
 */
import { execSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { Resource } from "sst";
import { skills } from "../web/src/db/schema";
import { seedSkills } from "./seed-data";

const __dirname = dirname(fileURLToPath(import.meta.url));
const s3 = new S3Client({});
const BUCKET = (Resource as any).SkillAssets.name;

async function uploadFile(key: string, filePath: string, contentType: string) {
  const body = readFileSync(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  const size = (body.length / 1024).toFixed(1);
  console.log(`  ✓ ${key} (${size} KB)`);
}

// --- Upload skill zips to S3 ---

async function uploadSkillZips() {
  const skillsDir = resolve(__dirname, "skills");
  if (!existsSync(skillsDir)) {
    console.log("No scripts/skills/ directory found, skipping zip upload.");
    return;
  }

  const skillFolders = readdirSync(skillsDir).filter((f) =>
    statSync(join(skillsDir, f)).isDirectory()
  );

  console.log(`Uploading ${skillFolders.length} skill packages to S3...`);

  for (const folder of skillFolders) {
    const folderPath = join(skillsDir, folder);
    const zipPath = join(skillsDir, `${folder}.zip`);

    execSync(`cd "${folderPath}" && zip -r "${zipPath}" . -x ".*"`, {
      stdio: "pipe",
    });

    await uploadFile(`skills/${folder}.zip`, zipPath, "application/zip");

    execSync(`rm "${zipPath}"`);
  }
}

// --- Seed skills table in Turso ---

async function seedSkillsTable() {
  const client = createClient({
    url: (Resource as any).TursoDbUrl.value,
    authToken: (Resource as any).TursoAuthToken.value,
  });
  const db = drizzle(client);

  console.log(`\nSeeding ${seedSkills.length} skills into database...`);

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

  console.log(`  ✓ ${seedSkills.length} skills seeded`);
  client.close();
}

// --- Main ---

async function main() {
  console.log(`Bucket: ${BUCKET}\n`);

  await uploadSkillZips();
  await seedSkillsTable();

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
