import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSkillBySlug, incrementDownloadCount } from "@/services/skill.service";
import { getDownloadUrl } from "@/services/storage.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const skill = await getSkillBySlug(db, slug);

  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  if (!skill.s3Key) {
    return NextResponse.json(
      { error: "Download not available" },
      { status: 404 }
    );
  }

  const downloadUrl = await getDownloadUrl(skill.s3Key);
  await incrementDownloadCount(db, slug);

  return NextResponse.json({ downloadUrl });
}
