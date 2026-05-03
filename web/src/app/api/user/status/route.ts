export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { skillDownloads, kitActivations } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ downloadedSlugs: [], activatedSlugs: [] });
  }

  const [downloads, activations] = await Promise.all([
    db
      .select({ slug: skillDownloads.skillSlug })
      .from(skillDownloads)
      .where(eq(skillDownloads.userId, session.user.id)),
    db
      .select({ slug: kitActivations.kitSlug })
      .from(kitActivations)
      .where(eq(kitActivations.userId, session.user.id)),
  ]);

  return NextResponse.json({
    downloadedSlugs: [...new Set(downloads.map((d) => d.slug))],
    activatedSlugs: activations.map((a) => a.slug),
  });
}
