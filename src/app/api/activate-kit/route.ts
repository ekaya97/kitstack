import { NextRequest, NextResponse } from "next/server";
import { provisionKitDatabase } from "../../../../packages/mcp-server/src/framework/db-provisioner";
import { getUserKitDb } from "../../../../packages/mcp-server/src/framework/dynamo";

// Kit migration SQL registry — maps kit slugs to their migration SQL
// In production, these would be loaded from the kit definitions
const KIT_MIGRATIONS: Record<string, string> = {
  "meeting-action-tracker": `
    CREATE TABLE IF NOT EXISTS meetings (id TEXT PRIMARY KEY, title TEXT NOT NULL, date TEXT NOT NULL, attendees TEXT NOT NULL, raw_notes TEXT NOT NULL, created_at INTEGER);
    CREATE TABLE IF NOT EXISTS action_items (id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL REFERENCES meetings(id), description TEXT NOT NULL, owner TEXT, deadline TEXT, status TEXT NOT NULL DEFAULT 'open', created_at INTEGER);
    CREATE TABLE IF NOT EXISTS decisions (id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL REFERENCES meetings(id), description TEXT NOT NULL, created_at INTEGER);
  `,
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

  // Check if already provisioned
  const existing = await getUserKitDb(userId, kitId);
  if (existing) {
    return NextResponse.json({
      status: "already_active",
      dbUrl: existing.dbUrl,
      provisionedAt: existing.provisionedAt,
    });
  }

  // Look up migration SQL for this kit
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
