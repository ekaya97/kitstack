import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { requireAdmin } from "@/lib/admin-auth";
import { desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      activeKits: sql<number>`(
        SELECT COUNT(*) FROM kit_activations
        WHERE kit_activations.user_id = ${user.id}
        AND kit_activations.status = 'active'
      )`.as("active_kits"),
      totalDownloads: sql<number>`(
        SELECT COUNT(*) FROM skill_downloads
        WHERE skill_downloads.user_id = ${user.id}
      )`.as("total_downloads"),
    })
    .from(user)
    .orderBy(desc(user.createdAt));

  return NextResponse.json({ users });
}
