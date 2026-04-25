import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import type { KitDefinition, KitContext, KitToolResult } from "../types";
import { kit } from "../result";
import { MigrationError } from "../errors";

export interface TestKit {
  /** Drizzle client connected to the in-memory test database. Use for assertions. */
  db: LibSQLDatabase;

  /** Call a tool by name with arguments. Uses default context { userId: "test-user", kitId }. */
  call(toolName: string, args?: Record<string, unknown>): Promise<KitToolResult>;

  /** Call a tool with a custom context (e.g. different userId). */
  callAs(
    ctx: Partial<KitContext>,
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<KitToolResult>;

  /** Delete all data from tables and re-run migrations. */
  reset(): Promise<void>;

  /** Close the database connection. Call in afterAll(). */
  cleanup(): Promise<void>;
}

/**
 * Creates an isolated in-memory SQLite database, runs migrations, and provides
 * direct tool invocation for testing kits.
 *
 * ```ts
 * const testKit = await createTestKit(myKit);
 * const result = await testKit.call("add_contact", { name: "Alice" });
 * expect(result.isError).toBeUndefined();
 * await testKit.cleanup();
 * ```
 */
export async function createTestKit(
  kitDef: KitDefinition
): Promise<TestKit> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client);

  async function runMigrations() {
    const statements = kitDef.migrationSql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err: any) {
        throw new MigrationError(
          "MIGRATION_FAILED",
          `Migration failed on statement: ${stmt.slice(0, 80)}... — ${err.message}`
        );
      }
    }
  }

  await runMigrations();

  const toolMap = new Map(kitDef.tools.map((t) => [t.name, t]));
  const defaultCtx: KitContext = { userId: "test-user", kitId: kitDef.id };

  async function callAs(
    ctxOverrides: Partial<KitContext>,
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<KitToolResult> {
    const ctx = { ...defaultCtx, ...ctxOverrides };
    const tool = toolMap.get(toolName);
    if (!tool) {
      return kit.error(
        `Unknown tool: "${toolName}". Available tools: ${[...toolMap.keys()].join(", ")}`
      );
    }

    const parsed = tool.args.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    // If handler exists, call it. If only load exists, auto-wrap with kit.json().
    if (tool.handler) {
      return tool.handler(db, parsed.data, ctx);
    }
    if (tool.load) {
      const data = await tool.load(db, parsed.data, ctx);
      return kit.json(data);
    }

    // Should never happen if defineKit validation ran
    return kit.error(`Tool "${toolName}" has neither handler() nor load().`);
  }

  return {
    db,

    call(toolName: string, args: Record<string, unknown> = {}) {
      return callAs({}, toolName, args);
    },

    callAs,

    async reset() {
      await client.execute("PRAGMA foreign_keys = OFF");
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      for (const row of tables.rows) {
        await client.execute(`DELETE FROM "${row.name}"`);
      }
      await client.execute("PRAGMA foreign_keys = ON");
    },

    async cleanup() {
      client.close();
    },
  };
}
