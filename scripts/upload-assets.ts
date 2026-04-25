import { execSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";

const s3 = new S3Client({});
const BUCKET = (Resource as any).Assets.name;
const ROOT = process.cwd();

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

// --- Zip and upload skill packages ---

async function uploadSkills() {
  const skillsDir = resolve(ROOT, "skills");
  if (!existsSync(skillsDir)) {
    console.log("No skills/ directory found, skipping.");
    return;
  }

  const skillFolders = readdirSync(skillsDir).filter((f) =>
    statSync(join(skillsDir, f)).isDirectory()
  );

  console.log(`\nUploading ${skillFolders.length} skill packages...`);

  for (const folder of skillFolders) {
    const folderPath = join(skillsDir, folder);
    const zipPath = join(skillsDir, `${folder}.zip`);

    // Create zip (overwrite if exists)
    execSync(`cd "${folderPath}" && zip -r "${zipPath}" . -x ".*"`, {
      stdio: "pipe",
    });

    await uploadFile(
      `skills/${folder}.zip`,
      zipPath,
      "application/zip"
    );

    // Clean up local zip
    execSync(`rm "${zipPath}"`);
  }
}

// --- Main ---

async function main() {
  console.log(`Bucket: ${BUCKET}`);

  await uploadSkills();

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
