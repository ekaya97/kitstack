import { describe, it, expect, afterEach } from "vitest";
import { existsSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { sql } from "drizzle-orm";
import { provisionDevDb } from "../src/runtime/dev-db";
import { MigrationError } from "../src/errors";

const TEST_DIR = resolve(tmpdir(), `kitstack-devdb-test-${Date.now()}`);
let dbPath: string;
let counter = 0;

function nextDbPath(): string {
  dbPath = resolve(TEST_DIR, `test-${++counter}`, "dev.db");
  return dbPath;
}

afterEach(() => {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {}
});

const MIGRATION = `
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL
  );
`;

describe("provisionDevDb", () => {
  it("creates the database file and runs migrations", async () => {
    const path = nextDbPath();
    const db = await provisionDevDb(path, MIGRATION);
    expect(db).toBeDefined();
    const result = await db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );
    const tables = result.map((r) => r.name);
    expect(tables).toContain("items");
    expect(tables).toContain("tags");
  });

  it("creates parent directories if missing", async () => {
    const path = resolve(TEST_DIR, "deep", "nested", "dir", "dev.db");
    await provisionDevDb(path, MIGRATION);
    expect(existsSync(path)).toBe(true);
  });

  it("throws MigrationError for invalid SQL", async () => {
    const path = nextDbPath();
    await expect(
      provisionDevDb(path, "THIS IS NOT VALID SQL")
    ).rejects.toThrow(MigrationError);
  });

  it("error includes the failing SQL statement", async () => {
    const path = nextDbPath();
    try {
      await provisionDevDb(path, "INVALID STATEMENT HERE");
    } catch (e: any) {
      expect(e.code).toBe("MIGRATION_FAILED");
      expect(e.message).toContain("INVALID STATEMENT HERE");
    }
  });

  it("handles multi-statement SQL with semicolons", async () => {
    const path = nextDbPath();
    const migSql = `
      CREATE TABLE a (id TEXT PRIMARY KEY);
      CREATE TABLE b (id TEXT PRIMARY KEY);
      CREATE TABLE c (id TEXT PRIMARY KEY);
    `;
    const db = await provisionDevDb(path, migSql);
    const result = await db.all<{ cnt: number }>(
      sql`SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table'`
    );
    expect(result[0].cnt).toBe(3);
  });

  it("reset=true deletes existing database before provisioning", async () => {
    const path = nextDbPath();

    // First provision — insert data
    const db1 = await provisionDevDb(path, "CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY);");
    await db1.run(sql`INSERT INTO t VALUES ('row1')`);

    // Second provision with reset — data should be gone
    const db2 = await provisionDevDb(path, "CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY);", { reset: true });
    const rows = await db2.all(sql`SELECT * FROM t`);
    expect(rows).toHaveLength(0);
  });

  it("reset=false preserves existing database", async () => {
    const path = nextDbPath();

    const db1 = await provisionDevDb(path, "CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY);");
    await db1.run(sql`INSERT INTO t VALUES ('row1')`);

    // Provision again without reset — data should persist
    const db2 = await provisionDevDb(path, "CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY);");
    const rows = await db2.all(sql`SELECT * FROM t`);
    expect(rows).toHaveLength(1);
  });
});
