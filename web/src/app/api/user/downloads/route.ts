import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { skillDownloads, skills } from "@/db/schema";
import { requireSession } from "@/lib/auth-session";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const downloads = await db
    .select({
      id: skillDownloads.id,
      skillSlug: skillDownloads.skillSlug,
      createdAt: skillDownloads.createdAt,
      skillName: skills.name,
      skillCategory: skills.category,
    })
    .from(skillDownloads)
    .leftJoin(skills, eq(skillDownloads.skillSlug, skills.slug))
    .where(eq(skillDownloads.userId, session.user.id))
    .orderBy(desc(skillDownloads.createdAt))
    .limit(50);

  return NextResponse.json({ downloads });
}
