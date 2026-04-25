import { NextResponse } from "next/server";
import { eq, and, ne } from "drizzle-orm";
import { requireAuthorized } from "@/lib/authz";
import { getSubscription } from "@/services/subscription.service";
import { getActiveKitCount, PLAN_LIMITS } from "@/services/kit-activation.service";
import { db } from "@/lib/db";
import { kitActivations, kits } from "@/db/schema";

export async function GET() {
  const auth = await requireAuthorized();
  if (!auth.ok) return auth.response;

  const subscription = await getSubscription(auth.userId);
  const plan = subscription?.plan ?? "starter";
  const limit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? 0;
  const activeCount = await getActiveKitCount(auth.userId);

  // Get all activations (active + deactivated, not archived)
  const activations = await db
    .select({
      kitSlug: kitActivations.kitSlug,
      status: kitActivations.status,
      activatedAt: kitActivations.createdAt,
      deactivatedAt: kitActivations.deactivatedAt,
      kitName: kits.name,
      kitCategory: kits.category,
      kitDescription: kits.description,
      kitReplaces: kits.replaces,
      kitSavingsPerMonth: kits.savingsPerMonth,
      kitMcpTools: kits.mcpTools,
      kitMcpApps: kits.mcpApps,
      kitDbSchema: kits.dbSchema,
    })
    .from(kitActivations)
    .leftJoin(kits, eq(kitActivations.kitSlug, kits.slug))
    .where(
      and(
        eq(kitActivations.userId, auth.userId),
        ne(kitActivations.status, "archived")
      )
    );

  return NextResponse.json({
    kits: activations,
    plan,
    activeCount,
    limit: limit === Infinity ? null : limit,
  });
}
