import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { kitId, userId } = body as { kitId?: string; userId?: string };

  if (!kitId || !userId) {
    return NextResponse.json(
      { error: "kitId and userId are required" },
      { status: 400 }
    );
  }

  const existing = await getUserKitDb(userId, kitId);
  if (existing) {
    return NextResponse.json({
      status: "already_active",
      dbUrl: existing.dbUrl,
      provisionedAt: existing.provisionedAt,
    });
  }

  const migrationSql = KIT_MIGRATIONS[kitId];
  if (!migrationSql) {
    return NextResponse.json(
      { error: `Unknown kit: ${kitId}` },
      { status: 404 }
    );
  }

  const result = await provisionKitDatabase(userId, kitId, migrationSql);

  return NextResponse.json({
    status: "activated",
    dbUrl: result.dbUrl,
    provisionedAt: new Date().toISOString(),
  });
}
