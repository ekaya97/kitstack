export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Resource } from "sst";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { requireSession } from "@/lib/auth-session";

let _s3: S3Client; function getS3() { if (!_s3) _s3 = new S3Client({}); return _s3; }

// POST: upload avatar directly
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const allowed = ["jpg", "jpeg", "png", "webp"];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: "File type not allowed. Use JPG, PNG, or WebP." }, { status: 400 });
  }

  const maxSize = 2 * 1024 * 1024; // 2MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: "File too large. Max 2MB." }, { status: 400 });
  }

  const key = `avatars/${session.user.id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await getS3().send(
    new PutObjectCommand({
      Bucket: Resource.UserAssets.name,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }),
  );

  // Generate a public-ish URL (presigned, long expiry)
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const imageUrl = await getSignedUrl(
    getS3(),
    new GetObjectCommand({
      Bucket: Resource.UserAssets.name,
      Key: key,
    }),
    { expiresIn: 60 * 60 * 24 * 365 }, // 1 year
  );

  // Update user record
  await db.update(user).set({ image: imageUrl }).where(eq(user.id, session.user.id));

  return NextResponse.json({ ok: true, imageUrl });
}
