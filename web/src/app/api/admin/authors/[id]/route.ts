import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { authors } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

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
  const body = await request.json();

  const [existing] = await db
    .select()
    .from(authors)
    .where(eq(authors.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Author not found" }, { status: 404 });
  }

  const updates: Record<string, any> = {};

  if (body.displayName !== undefined) updates.displayName = body.displayName;
  if (body.bio !== undefined) updates.bio = body.bio || null;
  if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl || null;
  if (body.verified !== undefined) updates.verified = Boolean(body.verified);
  if (body.website !== undefined) updates.website = body.website || null;
  if (body.location !== undefined) updates.location = body.location || null;
  if (body.userId !== undefined) updates.userId = body.userId || null;

  await db.update(authors).set(updates).where(eq(authors.id, id));

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
    .from(authors)
    .where(eq(authors.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Author not found" }, { status: 404 });
  }

  await db.delete(authors).where(eq(authors.id, id));

  return NextResponse.json({ ok: true });
}
