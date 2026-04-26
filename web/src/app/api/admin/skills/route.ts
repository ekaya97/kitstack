import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import { db } from "@/lib/db";
import { skills } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

const s3 = new S3Client({});

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allSkills = await db.select().from(skills).orderBy(skills.name);
  return NextResponse.json({ skills: allSkills });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();

  const slug = formData.get("slug") as string;
  const name = formData.get("name") as string;
  const category = formData.get("category") as string;
  const description = formData.get("description") as string;
  const tags = JSON.parse((formData.get("tags") as string) || "[]");
  const compatibility = JSON.parse((formData.get("compatibility") as string) || '["claude.ai","Claude Desktop","Cowork","Claude Code"]');
  const exampleInput = formData.get("exampleInput") as string || "";
  const exampleOutput = formData.get("exampleOutput") as string || "";
  const whatsInside = JSON.parse((formData.get("whatsInside") as string) || "[]");
  const composition = JSON.parse((formData.get("composition") as string) || '{"skillMd":true,"references":0,"examples":0,"templates":0,"scripts":0,"agents":0}');
  const upgradeHook = (formData.get("upgradeHook") as string) || null;
  const correspondingKitSlug = (formData.get("correspondingKitSlug") as string) || null;
  const author = (formData.get("author") as string) || "kitstack";
  const zipFile = formData.get("zipFile") as File | null;

  if (!slug || !name || !category || !description) {
    return NextResponse.json(
      { error: "Missing required fields: slug, name, category, description" },
      { status: 400 },
    );
  }

  // Upload zip to S3 if provided
  let s3Key: string | null = null;
  let fileSize: string | null = null;
  if (zipFile) {
    s3Key = `skills/${slug}.zip`;
    const buffer = Buffer.from(await zipFile.arrayBuffer());
    fileSize = `${(buffer.length / 1024).toFixed(0)} KB`;

    await s3.send(
      new PutObjectCommand({
        Bucket: Resource.SkillAssets.name,
        Key: s3Key,
        Body: buffer,
        ContentType: "application/zip",
      }),
    );
  }

  const id = `skill-${slug}`;
  const now = new Date();

  await db
    .insert(skills)
    .values({
      id,
      slug,
      name,
      category: category as any,
      description,
      upgradeHook,
      tags,
      compatibility,
      exampleInput,
      exampleOutput,
      whatsInside,
      composition,
      s3Key,
      author,
      fileSize,
      correspondingKitSlug,
      downloadCount: 0,
      avgRating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: skills.slug,
      set: {
        name,
        category: category as any,
        description,
        upgradeHook,
        tags,
        compatibility,
        exampleInput,
        exampleOutput,
        whatsInside,
        composition,
        ...(s3Key ? { s3Key, fileSize } : {}),
        author,
        correspondingKitSlug,
        updatedAt: now,
      },
    });

  return NextResponse.json({ ok: true, slug });
}
