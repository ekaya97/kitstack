import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getSessionOrNull } from "@/lib/auth-session";
import { getSubscription } from "@/services/subscription.service";
import { canActivateKit, reactivateKit } from "@/services/kit-activation.service";
import { db } from "@/lib/db";
import { kitActivations } from "@/db/schema";
import {
  provisionKitDatabase,
} from "../../../../packages/mcp-server/src/framework/db-provisioner";
import {
  getUserKitDb,
  setToolsChanged,
} from "../../../../packages/mcp-server/src/framework/dynamo";
import { migrationSql as meetingMigrations } from "../../../../packages/mcp-server/src/kits/meeting/migrations";
import { migrationSql as crmMigrations } from "../../../../packages/mcp-server/src/kits/crm/migrations";
import { migrationSql as expenseMigrations } from "../../../../packages/mcp-server/src/kits/expense/migrations";
import { migrationSql as outreachMigrations } from "../../../../packages/mcp-server/src/kits/outreach/migrations";

const VALID_KIT_SLUGS = [
  "crm-kit",
  "expense-tax-prep-kit",
  "cold-outreach-kit",
  "meeting-action-tracker-kit",
];

const SLUG_TO_KIT_ID: Record<string, string> = {
  "crm-kit": "crm",
  "expense-tax-prep-kit": "expense-tax-prep",
  "cold-outreach-kit": "cold-outreach",
  "meeting-action-tracker-kit": "meeting-action-tracker",
};

const KIT_MIGRATIONS: Record<string, string> = {
  crm: crmMigrations,
  "expense-tax-prep": expenseMigrations,
  "cold-outreach": outreachMigrations,
  "meeting-action-tracker": meetingMigrations,
};

export async function POST(request: NextRequest) {
  const session = await getSessionOrNull();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { kitSlug } = body as { kitSlug?: string };

  if (!kitSlug) {
    return NextResponse.json({ error: "kitSlug is required" }, { status: 400 });
  }

  if (!VALID_KIT_SLUGS.includes(kitSlug)) {
    return NextResponse.json({ error: `Unknown kit: ${kitSlug}` }, { status: 404 });
  }

  const subscription = await getSubscription(session.user.id);
  if (!subscription) {
    return NextResponse.json(
      { error: "Active subscription required." },
      { status: 403 }
    );
  }

  const kitId = SLUG_TO_KIT_ID[kitSlug];

  // Check if already active
  const existing = await db
    .select()
    .from(kitActivations)
    .where(
      and(
        eq(kitActivations.userId, session.user.id),
        eq(kitActivations.kitSlug, kitSlug)
      )
    )
    .then((r) => r[0]);

  if (existing?.status === "active") {
    return NextResponse.json({ status: "already_active", kitSlug });
  }

  // If previously deactivated/archived, reactivate
  if (existing) {
    const { allowed, activeCount, limit } = await canActivateKit(
      session.user.id,
      subscription.plan
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Your ${subscription.plan} plan allows ${limit} active kit${limit !== 1 ? "s" : ""}. You have ${activeCount} active. Deactivate one first.`,
          activeCount,
          limit,
        },
        { status: 403 }
      );
    }
    await reactivateKit(session.user.id, kitSlug);
    await setToolsChanged(session.user.id);
    return NextResponse.json({ status: "activated", kitSlug });
  }

  // New activation — check limit
  const { allowed, activeCount, limit } = await canActivateKit(
    session.user.id,
    subscription.plan
  );
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Your ${subscription.plan} plan allows ${limit} active kit${limit !== 1 ? "s" : ""}. You have ${activeCount} active. Deactivate one first.`,
        activeCount,
        limit,
      },
      { status: 403 }
    );
  }

  // Provision the kit database if not already provisioned
  const existingDb = await getUserKitDb(session.user.id, kitId);
  if (!existingDb) {
    const migrationSql = KIT_MIGRATIONS[kitId];
    if (migrationSql) {
      await provisionKitDatabase(session.user.id, kitId, migrationSql);
    }
  }

  // Record activation locally
  await db.insert(kitActivations).values({
    id: nanoid(),
    userId: session.user.id,
    kitSlug,
    status: "active",
  });

  // Signal the MCP router that this user's tool list has changed
  await setToolsChanged(session.user.id);

  return NextResponse.json({ status: "activated", kitSlug });
}
