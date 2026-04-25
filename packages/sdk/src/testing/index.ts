import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import type { KitDefinition, KitContext, KitToolResult, AuthzRequirement } from "../types";
import { kit } from "../result";
import { MigrationError } from "../errors";

/**
 * An isolated test harness for a kit. Wraps an in-memory SQLite database
 * with migrations applied and provides direct tool/view invocation without
 * any MCP transport or network overhead.
 *
 * Obtain an instance via {@link createTestKit}. Call {@link cleanup} in
 * `afterAll()` to release the database connection.
 *
 * @example
 * ```typescript
 * import { createTestKit, type TestKit } from "@kitstackdev/kit/testing";
 * import crmKit from "../kit.config";
 * import { contacts } from "../src/schema";
 *
 * describe("CRM tools", () => {
 *   let testKit: TestKit;
 *
 *   beforeAll(async () => { testKit = await createTestKit(crmKit); });
 *   afterEach(async () => { await testKit.reset(); });
 *   afterAll(async () => { await testKit.cleanup(); });
 *
 *   it("creates a contact", async () => {
 *     const result = await testKit.call("add_contact", { name: "Alice Smith" });
 *     expect(result.isError).toBeUndefined();
 *
 *     // Direct DB access for assertions
 *     const rows = await testKit.db.select().from(contacts);
 *     expect(rows).toHaveLength(1);
 *     expect(rows[0].name).toBe("Alice Smith");
 *   });
 * });
 * ```
 */
export interface TestKit {
  /**
   * Drizzle client connected to the in-memory test database.
   * Use for direct SQL assertions after calling tools.
   *
   * @example
   * ```typescript
   * const rows = await testKit.db.select().from(contacts);
   * expect(rows).toHaveLength(1);
   * ```
   */
  db: LibSQLDatabase;

  /**
   * Call a tool by name with arguments. Uses the default context
   * `{ userId: "test-user", kitId: "<kit-id>" }`.
   *
   * Returns a `KitToolResult` — check `result.isError` and read
   * `result.content[0].text` for the response body.
   *
   * Returns an error result (not a thrown exception) when the tool name
   * is unknown or argument validation fails.
   *
   * @param toolName - The snake_case tool name (e.g. `"add_contact"`)
   * @param args - Arguments matching the tool's Zod schema
   *
   * @example
   * ```typescript
   * const result = await testKit.call("add_contact", {
   *   name: "Bob Jones",
   *   company: "Acme Corp",
   *   email: "bob@acme.com",
   * });
   * expect(result.isError).toBeUndefined();
   * expect(result.content[0].text).toContain("Bob Jones");
   * ```
   */
  call(toolName: string, args?: Record<string, unknown>): Promise<KitToolResult>;

  /**
   * Call a tool with a custom context. Use this to test multi-user
   * scenarios or to override the default `userId`.
   *
   * @param ctx - Partial context overrides (e.g. `{ userId: "alice" }`)
   * @param toolName - The snake_case tool name
   * @param args - Arguments matching the tool's Zod schema
   *
   * @example
   * ```typescript
   * const result = await testKit.callAs(
   *   { userId: "custom-user-123" },
   *   "add_contact",
   *   { name: "Custom User Contact" },
   * );
   * expect(result.isError).toBeUndefined();
   * ```
   */
  callAs(
    ctx: Partial<KitContext>,
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<KitToolResult>;

  /**
   * Execute a view's loader directly and return its typed data.
   * Useful for testing loader logic without MCP overhead or view rendering.
   *
   * Throws an `Error` if the view slug is not found.
   *
   * @param viewSlug - The kebab-case view slug (e.g. `"pipeline"`)
   * @param ctx - Optional partial context overrides
   *
   * @example
   * ```typescript
   * const data = await testKit.loadView("pipeline");
   * expect(data.deals).toHaveLength(3);
   * ```
   */
  loadView(viewSlug: string, ctx?: Partial<KitContext>): Promise<unknown>;

  /**
   * Delete all rows from every table and reset the database to a clean
   * post-migration state. Call in `afterEach()` to isolate tests.
   *
   * This does NOT re-run migrations — it only clears data.
   *
   * @example
   * ```typescript
   * afterEach(async () => {
   *   await testKit.reset();
   * });
   * ```
   */
  reset(): Promise<void>;

  /**
   * Close the database connection. Call in `afterAll()` to release resources.
   *
   * @example
   * ```typescript
   * afterAll(async () => {
   *   await testKit.cleanup();
   * });
   * ```
   */
  cleanup(): Promise<void>;
}

/**
 * Creates an isolated in-memory SQLite database, runs the kit's migration SQL,
 * and returns a {@link TestKit} harness for direct tool and view invocation.
 *
 * This is the primary entry point for testing kits. The in-memory database
 * is fully isolated — each `createTestKit()` call gets its own database, so
 * tests can run in parallel without interference.
 *
 * Throws {@link MigrationError} if any SQL statement in `kitDef.migrationSql`
 * fails to execute (e.g. syntax errors, invalid table definitions).
 *
 * @param kitDef - A kit definition returned by `defineKit()`
 * @returns A promise resolving to a {@link TestKit} instance
 *
 * @example
 * ```typescript
 * import { describe, it, expect, afterEach, afterAll } from "vitest";
 * import { createTestKit } from "@kitstackdev/kit/testing";
 * import crmKit from "../kit.config";
 * import { contacts, deals } from "../src/schema";
 *
 * describe("CRM kit", () => {
 *   let testKit: Awaited<ReturnType<typeof createTestKit>>;
 *
 *   beforeAll(async () => { testKit = await createTestKit(crmKit); });
 *   afterEach(async () => { await testKit.reset(); });
 *   afterAll(async () => { await testKit.cleanup(); });
 *
 *   it("creates a contact and verifies in DB", async () => {
 *     const result = await testKit.call("add_contact", { name: "Alice Smith" });
 *     expect(result.isError).toBeUndefined();
 *
 *     const rows = await testKit.db.select().from(contacts);
 *     expect(rows).toHaveLength(1);
 *     expect(rows[0].name).toBe("Alice Smith");
 *   });
 *
 *   it("handles deal creation and listing", async () => {
 *     await testKit.call("add_contact", { name: "Alice" });
 *     const contactRows = await testKit.db.select().from(contacts);
 *
 *     const dealResult = await testKit.call("add_deal", {
 *       name: "Enterprise License",
 *       contactId: contactRows[0].id,
 *       value: 50000,
 *       stage: "proposal",
 *     });
 *     expect(dealResult.isError).toBeUndefined();
 *
 *     const listResult = await testKit.call("list_deals", {});
 *     expect(listResult.content[0].text).toContain("Enterprise License");
 *   });
 *
 *   it("validates arguments with Zod", async () => {
 *     // add_contact requires name (string) — passing empty args fails
 *     const result = await testKit.call("add_contact", {});
 *     expect(result.isError).toBe(true);
 *     expect(result.content[0].text).toContain("Invalid arguments");
 *   });
 * });
 * ```
 */
export async function createTestKit(
  kitDef: KitDefinition,
  options?: {
    /**
     * Authorization check function for testing tools with `authorize` hooks.
     * If omitted, authorize hooks are skipped (all calls permitted).
     */
    checkAuthz?: (
      db: LibSQLDatabase,
      requirement: AuthzRequirement,
      ctx: KitContext
    ) => Promise<boolean>;
  }
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
  const viewMap = new Map((kitDef.views ?? []).map((v) => [v.slug, v]));
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

    // Run authorize hook if present and checkAuthz is configured
    if (tool.authorize && options?.checkAuthz) {
      const requirements = tool.authorize(parsed.data, ctx);
      for (const req of requirements) {
        const allowed = await options.checkAuthz(db, req, ctx);
        if (!allowed) {
          return {
            content: [{
              type: "text" as const,
              text: `Forbidden: missing "${req.relation}" on ${req.objectType} "${req.objectId}"`,
            }],
            isError: true,
          };
        }
      }
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

    async loadView(viewSlug: string, ctxOverrides: Partial<KitContext> = {}) {
      const view = viewMap.get(viewSlug);
      if (!view) {
        throw new Error(
          `Unknown view: "${viewSlug}". Available views: ${[...viewMap.keys()].join(", ") || "(none)"}`
        );
      }
      const ctx = { ...defaultCtx, ...ctxOverrides };
      return view.loader(db, ctx);
    },

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
