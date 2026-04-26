import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { skills } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

const s3 = new S3Client({});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const formData = await request.formData();

  const [existing] = await db
    .select()
    .from(skills)
    .where(eq(skills.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const updates: Record<string, any> = { updatedAt: new Date() };

  const textFields = ["name", "description", "upgradeHook", "correspondingKitSlug", "author"] as const;
  for (const field of textFields) {
    const val = formData.get(field);
    if (val !== null) updates[field] = val as string;
  }

  const category = formData.get("category");
  if (category !== null) updates.category = category as string;

  const jsonFields = ["tags", "compatibility", "whatsInside", "composition"] as const;
  for (const field of jsonFields) {
    const val = formData.get(field);
    if (val !== null) updates[field] = JSON.parse(val as string);
  }

  const exampleInput = formData.get("exampleInput");
  if (exampleInput !== null) updates.exampleInput = exampleInput as string;
  const exampleOutput = formData.get("exampleOutput");
  if (exampleOutput !== null) updates.exampleOutput = exampleOutput as string;

  // Handle zip re-upload
  const zipFile = formData.get("zipFile") as File | null;
  if (zipFile) {
    const s3Key = `skills/${existing.slug}.zip`;
    const buffer = Buffer.from(await zipFile.arrayBuffer());
    updates.s3Key = s3Key;
    updates.fileSize = `${(buffer.length / 1024).toFixed(0)} KB`;

    await s3.send(
      new PutObjectCommand({
        Bucket: Resource.SkillAssets.name,
        Key: s3Key,
        Body: buffer,
        ContentType: "application/zip",
      }),
    );
  }

  await db.update(skills).set(updates).where(eq(skills.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(skills)
    .where(eq(skills.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  // Delete S3 object if present
  if (existing.s3Key) {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: Resource.SkillAssets.name,
        Key: existing.s3Key,
      }),
    );
  }

  await db.delete(skills).where(eq(skills.id, id));

  return NextResponse.json({ ok: true });
}
