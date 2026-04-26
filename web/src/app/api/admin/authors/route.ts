import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authors } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allAuthors = await db.select().from(authors).orderBy(authors.displayName);
  return NextResponse.json({ authors: allAuthors });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const handle = body.handle as string;
  const displayName = body.displayName as string;
  const bio = (body.bio as string) || null;
  const avatarUrl = (body.avatarUrl as string) || null;
  const verified = Boolean(body.verified);
  const website = (body.website as string) || null;
  const location = (body.location as string) || null;
  const userId = (body.userId as string) || null;

  if (!handle || !displayName) {
    return NextResponse.json(
      { error: "Missing required fields: handle, displayName" },
      { status: 400 },
    );
  }

  const id = `author-${handle}`;
  const now = new Date();

  await db.insert(authors).values({
    id,
    handle,
    displayName,
    bio,
    avatarUrl,
    verified,
    website,
    location,
    userId,
    createdAt: now,
  });

  return NextResponse.json({ ok: true, id });
}
