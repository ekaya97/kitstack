export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kits } from "@/db/schema";
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
    .from(kits)
    .where(eq(kits.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Kit not found" }, { status: 404 });
  }

  const updates: Record<string, any> = { updatedAt: new Date() };

  // Nullable text fields
  const nullableTextFields = [
    "correspondingSkillSlug",
    "dbSchema",
    "tagline",
  ] as const;
  for (const field of nullableTextFields) {
    if (body[field] !== undefined) updates[field] = body[field] || null;
  }

  // Required text fields (not nullable)
  const requiredTextFields = ["name", "description", "replaces", "author"] as const;
  for (const field of requiredTextFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  if (body.category !== undefined) updates.category = body.category;
  if (body.status !== undefined) updates.status = body.status;
  if (body.savingsPerMonth !== undefined) updates.savingsPerMonth = Number(body.savingsPerMonth);

  if (body.mcpTools !== undefined) {
    updates.mcpTools = body.mcpTools ? JSON.parse(body.mcpTools) : null;
  }
  if (body.mcpApps !== undefined) {
    updates.mcpApps = body.mcpApps ? JSON.parse(body.mcpApps) : null;
  }

  await db.update(kits).set(updates).where(eq(kits.id, id));

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
    .from(kits)
    .where(eq(kits.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Kit not found" }, { status: 404 });
  }

  await db.delete(kits).where(eq(kits.id, id));

  return NextResponse.json({ ok: true });
}
