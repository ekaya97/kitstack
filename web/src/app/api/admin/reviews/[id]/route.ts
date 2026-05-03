export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviews, reviewHelpful } from "@/db/schema";
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
    .from(reviews)
    .where(eq(reviews.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  if (typeof body.verified !== "boolean") {
    return NextResponse.json(
      { error: "Body must contain { verified: boolean }" },
      { status: 400 },
    );
  }

  await db
    .update(reviews)
    .set({ verified: body.verified, updatedAt: new Date() })
    .where(eq(reviews.id, id));

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
    .from(reviews)
    .where(eq(reviews.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Delete associated helpful votes first
  await db.delete(reviewHelpful).where(eq(reviewHelpful.reviewId, id));

  // Delete the review
  await db.delete(reviews).where(eq(reviews.id, id));

  return NextResponse.json({ ok: true });
}
