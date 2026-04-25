/**
 * Migration: Add lambda_resource column to kit_registry table.
 *
 * This column stores the SST Resource name (e.g. "KitCrm") so the router
 * can dynamically resolve Lambda ARNs without hardcoded maps.
 *
 * Run: npx sst shell -- npx tsx packages/mcp-server/src/scripts/migrate-registry-lambda-resource.ts
 */
import { getTursoDb } from "../router/authz";
import { sql } from "drizzle-orm";

async function main() {
  const db = getTursoDb();

  // SQLite ALTER TABLE ADD COLUMN is safe — it's a no-op if the column already exists
  // (well, SQLite errors on duplicate column, so we check first)
  const tableInfo = await db.all<{ name: string }>(
    sql`PRAGMA table_info(kit_registry)`
  );

  const hasColumn = tableInfo.some((col) => col.name === "lambda_resource");
  if (hasColumn) {
    console.log("Column lambda_resource already exists on kit_registry. Skipping.");
    return;
  }

  await db.run(sql`ALTER TABLE kit_registry ADD COLUMN lambda_resource TEXT`);
  console.log("Added lambda_resource column to kit_registry.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
