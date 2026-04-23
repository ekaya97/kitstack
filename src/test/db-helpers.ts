import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { testSkills } from "./fixtures/skills";
import { testKits } from "./fixtures/kits";

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export async function createTestDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      upgrade_hook TEXT,
      tags TEXT NOT NULL,
      compatibility TEXT NOT NULL,
      example_input TEXT NOT NULL,
      example_output TEXT NOT NULL,
      whats_inside TEXT NOT NULL,
      composition TEXT NOT NULL,
      s3_key TEXT,
      download_count INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS kits (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      corresponding_skill_slug TEXT,
      replaces TEXT NOT NULL,
      savings_per_month INTEGER NOT NULL,
      db_schema TEXT,
      mcp_tools TEXT,
      mcp_apps TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      lemonsqueezy_subscription_id TEXT,
      current_period_end INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  return db;
}

export async function seedTestSkills(db: TestDb) {
  for (const skill of testSkills) {
    await db.insert(schema.skills).values(skill);
  }
}

export async function seedTestKits(db: TestDb) {
  for (const kit of testKits) {
    await db.insert(schema.kits).values(kit);
  }
}

export async function seedAll(db: TestDb) {
  await seedTestSkills(db);
  await seedTestKits(db);
}
