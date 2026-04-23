import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getSessionOrNull } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { kitActivations, kits } from "@/db/schema";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activations = await db
    .select({
      kitSlug: kitActivations.kitSlug,
      activatedAt: kitActivations.createdAt,
      kitName: kits.name,
      kitCategory: kits.category,
      kitDescription: kits.description,
      kitReplaces: kits.replaces,
      kitSavingsPerMonth: kits.savingsPerMonth,
    })
    .from(kitActivations)
    .leftJoin(kits, eq(kitActivations.kitSlug, kits.slug))
    .where(
      and(
        eq(kitActivations.userId, session.user.id),
        eq(kitActivations.status, "active")
      )
    );

  return NextResponse.json({ kits: activations });
}
