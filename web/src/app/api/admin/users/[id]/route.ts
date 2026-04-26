import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { kitActivations, skillDownloads, subscriptions } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [foundUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  if (!foundUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const activations = await db
    .select()
    .from(kitActivations)
    .where(eq(kitActivations.userId, id))
    .orderBy(desc(kitActivations.createdAt));

  const downloads = await db
    .select()
    .from(skillDownloads)
    .where(eq(skillDownloads.userId, id))
    .orderBy(desc(skillDownloads.createdAt))
    .limit(20);

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return NextResponse.json({
    user: foundUser,
    activations,
    downloads,
    subscription: subscription || null,
  });
}

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

  if (!body.role || !["admin", "user"].includes(body.role)) {
    return NextResponse.json(
      { error: "Invalid role. Must be 'admin' or 'user'." },
      { status: 400 },
    );
  }

  const [foundUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  if (!foundUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await db
    .update(user)
    .set({ role: body.role })
    .where(eq(user.id, id));

  return NextResponse.json({ ok: true, role: body.role });
}
