export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSkillBySlug, incrementDownloadCount } from "@/services/skill.service";
import { getDownloadUrl } from "@/services/storage.service";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { skillDownloads } from "@/db/schema";
import { nanoid } from "nanoid";
import { trackSkillDownloaded } from "@/lib/analytics-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const skill = await getSkillBySlug(slug);

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
  await incrementDownloadCount(slug);

  // Record download — userId is null for anonymous
  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    userId = session?.user?.id ?? null;
  } catch {
    // Not logged in
  }

  await db.insert(skillDownloads).values({
    id: nanoid(),
    userId,
    skillSlug: slug,
  });

  trackSkillDownloaded(userId, slug);

  return NextResponse.json({ downloadUrl });
}
