import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { getSessionOrNull } from "@/lib/auth-session";
import { getSubscription } from "@/services/subscription.service";
import { db } from "@/lib/db";
import { kitActivations } from "@/db/schema";
import { provisionKitDatabase } from "../../../../packages/mcp-server/src/framework/db-provisioner";
import { getUserKitDb } from "../../../../packages/mcp-server/src/framework/dynamo";
import { migrationSql as meetingMigrations } from "../../../../packages/mcp-server/src/kits/meeting/migrations";
import { migrationSql as crmMigrations } from "../../../../packages/mcp-server/src/kits/crm/migrations";
import { migrationSql as expenseMigrations } from "../../../../packages/mcp-server/src/kits/expense/migrations";
import { migrationSql as outreachMigrations } from "../../../../packages/mcp-server/src/kits/outreach/migrations";

const KIT_MIGRATIONS: Record<string, string> = {
  "meeting-action-tracker": meetingMigrations,
  crm: crmMigrations,
  "expense-tax-prep": expenseMigrations,
  "cold-outreach": outreachMigrations,
};

// Map kit slugs (from the kits catalogue) to kit IDs (used by the MCP server)
const SLUG_TO_KIT_ID: Record<string, string> = {
  "crm-kit": "crm",
  "expense-tax-prep-kit": "expense-tax-prep",
  "cold-outreach-kit": "cold-outreach",
  "meeting-action-tracker-kit": "meeting-action-tracker",
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

  // Check subscription
  const subscription = await getSubscription(session.user.id);
  if (!subscription) {
    return NextResponse.json(
      { error: "Active subscription required. Subscribe at /pricing first." },
      { status: 403 }
    );
  }

  // Resolve kit ID
  const kitId = SLUG_TO_KIT_ID[kitSlug];
  if (!kitId) {
    return NextResponse.json({ error: `Unknown kit: ${kitSlug}` }, { status: 404 });
  }

  // Check if already activated
  const existingActivation = await db
    .select()
    .from(kitActivations)
    .where(
      and(
        eq(kitActivations.userId, session.user.id),
        eq(kitActivations.kitSlug, kitSlug),
        eq(kitActivations.status, "active")
      )
    )
    .then((r) => r[0]);

  if (existingActivation) {
    return NextResponse.json({ status: "already_active", kitSlug });
  }

  // Check if DB already provisioned (from a previous activation)
  const existingDb = await getUserKitDb(session.user.id, kitId);
  if (!existingDb) {
    const migrationSql = KIT_MIGRATIONS[kitId];
    if (!migrationSql) {
      return NextResponse.json({ error: `No migrations for kit: ${kitId}` }, { status: 500 });
    }
    await provisionKitDatabase(session.user.id, kitId, migrationSql);
  }

  // Record activation locally
  await db.insert(kitActivations).values({
    id: nanoid(),
    userId: session.user.id,
    kitSlug,
    status: "active",
  }).onConflictDoUpdate({
    target: [kitActivations.userId, kitActivations.kitSlug],
    set: { status: "active" },
  });

  return NextResponse.json({ status: "activated", kitSlug });
}
