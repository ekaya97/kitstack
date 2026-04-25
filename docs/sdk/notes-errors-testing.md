# Dev Notes: Error Hierarchy + Testing Harness

**Tickets:** T-0002 (error hierarchy), T-0016 (createTestKit), T-0031 (outreach handler), T-0032 (expense migration), T-0033 (meeting migration)

---

## What was built

### Error hierarchy (`packages/sdk/src/errors.ts`)

A six-class error hierarchy rooted at `KitStackError`. Every error carries a machine-readable `code` and an auto-generated `docUrl` pointing to `https://docs.kitstack.dev/errors/{code}`.

```
KitStackError
  KitValidationError   — kit-level structural problems (duplicate tools, bad view slugs)
  ToolValidationError   — tool-level problems (missing impl, bad name, short description)
  MigrationError        — SQL migration failures
  SchemaError           — Drizzle schema mismatches
  AuthError             — CLI authentication failures
```

These are SDK-level errors thrown during `defineKit()`, `createTestKit()`, or CLI commands. They are **not** used for tool-execution errors — those go through `kit.error()` / `kit.notFound()` and return `KitToolResult` with `isError: true`.

Key design: the `code` field is a constant string (e.g. `"TOOL_INVALID_NAME"`, `"KIT_DUPLICATE_TOOLS"`) so consumers can `switch` on it without parsing the message. The `docUrl` is derived from the code automatically.

### Testing harness (`packages/sdk/src/testing/index.ts`)

`createTestKit(kitDef)` spins up an in-memory SQLite database, runs the kit's migration SQL, and returns a `TestKit` object with five methods:

| Method | Purpose |
|--------|---------|
| `call(toolName, args?)` | Invoke a tool with default context `{ userId: "test-user", kitId }` |
| `callAs(ctx, toolName, args?)` | Invoke a tool with custom context (e.g. different `userId`) |
| `loadView(viewSlug, ctx?)` | Run a view's loader directly, get typed data back |
| `reset()` | Delete all rows from all tables (keeps schema) |
| `cleanup()` | Close the DB connection |

The harness validates arguments with Zod before calling the handler, exactly like production. Unknown tool names and validation failures return `KitToolResult` with `isError: true` rather than throwing — matching the MCP protocol behavior.

Tools defined with only `load()` (no `handler()`) are auto-wrapped with `kit.json()`, which is the same behavior as `defineTool()` in production.

### Handler pattern (outreach, expense, meeting kits)

Each kit has a `handler.ts` that creates a Drizzle client from the Lambda event's `dbUrl`/`dbToken`, builds a `KitContext`, and dispatches to the right tool or loader. This is the production equivalent of what `createTestKit` does in tests. The pattern is identical across all three kits:

```typescript
const toolMap = new Map(kit.tools.map((t) => [t.name, t]));
const viewMap = new Map((kit.views ?? []).map((v) => [v.slug, v]));

export const handler = async (event: KitToolInvocation) => {
  const client = createClient({ url: event.dbUrl, authToken: event.dbToken });
  const db = drizzle(client);
  const ctx: KitContext = { userId: event.userId, kitId: event.kitId };

  if (event.loaderSlug) { /* dispatch to view loader */ }
  /* dispatch to tool handler */
};
```

### Migrations (expense, meeting kits)

Both kits use the `migrationSql` string pattern — a single template literal with semicolon-separated `CREATE TABLE IF NOT EXISTS` statements:

```typescript
// kits/expense/src/migrations.ts
export const migrationSql = `
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_gross REAL NOT NULL,
  ...
);

CREATE TABLE IF NOT EXISTS quarterly_summaries (...);
CREATE TABLE IF NOT EXISTS settings (...);
`;
```

`createTestKit` splits on `;`, trims, filters blanks, and executes each statement. If any fails, it throws `MigrationError` with the failing statement truncated to 80 chars.

---

## What we learned

### Gotcha: error hierarchy vs tool result errors

The biggest source of confusion is the two error channels:

1. **SDK errors** (thrown exceptions) — `KitStackError` subclasses. These are programming mistakes caught at definition time. They crash the process.
2. **Tool result errors** (`kit.error()`, `kit.notFound()`) — these are returned as `KitToolResult` with `isError: true`. They flow back to the LLM as error responses.

Rule of thumb: if the LLM should see the error and can recover, use `kit.error()`. If it's a developer mistake that should never reach production, throw a `KitStackError` subclass.

### Gotcha: MigrationError thrown at test setup, not at call time

When `createTestKit()` is called, it runs all migrations immediately. If any SQL is bad, the promise rejects with `MigrationError`. This means bad migration SQL is caught before any test runs, not when a tool is called. This is good — but it means tests that assert on `MigrationError` need to wrap the `createTestKit()` call itself:

```typescript
// Correct
await expect(createTestKit(badKit)).rejects.toThrow(MigrationError);

// Wrong — this would never reach the migration error
const testKit = await createTestKit(badKit);  // already rejected
await testKit.call("some_tool");
```

### Gotcha: reset() deletes data but does NOT re-run migrations

`reset()` uses `DELETE FROM` on each table, not `DROP TABLE` + re-create. This is intentional — it's faster and avoids potential issues with foreign key ordering. But it means if your migration has `INSERT` seed data, that data won't be re-seeded after `reset()`. If you need seed data in tests, call your seeding tool again after `reset()`.

### Gotcha: migration SQL splitting is naive

The migration runner splits on `;` which means semicolons inside string literals or trigger bodies will break it. In practice this hasn't been an issue because our kits use simple DDL, but it's a known limitation for future complex migrations.

### Edge case: load-only tools return JSON strings

Tools that define only `load()` get auto-wrapped with `kit.json()`, which serializes the return value with `JSON.stringify(data, null, 2)`. The result is a `KitToolResult` with a JSON string in `content[0].text`. In tests you need to parse it:

```typescript
const result = await testKit.call("count_items");
const data = JSON.parse(result.content[0].text);
expect(data.total).toBe(2);
```

### Validation is strict on tool names and descriptions

`defineKit()` enforces snake_case for tool names, kebab-case for view slugs, and a minimum 10-character description. It also warns (but doesn't throw) about descriptions over 200 chars and missing `.describe()` on Zod fields. The warnings help LLMs understand tool arguments, so don't ignore them.

---

## How to use it

### Standard test setup pattern (from CRM kit)

```typescript
import { describe, it, expect, afterEach, afterAll } from "vitest";
import { createTestKit } from "@kitstackdev/kit/testing";
import crmKit from "../kit.config";
import { contacts, deals, activities } from "../src/schema";

describe("CRM tools", () => {
  let testKit: Awaited<ReturnType<typeof createTestKit>>;

  beforeAll(async () => {
    testKit = await createTestKit(crmKit);
  });

  afterEach(async () => {
    await testKit.reset();
  });

  afterAll(async () => {
    await testKit.cleanup();
  });

  it("creates a contact via add_contact", async () => {
    const result = await testKit.call("add_contact", { name: "Alice Smith" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Alice Smith");

    // Verify directly in DB
    const rows = await testKit.db.select().from(contacts);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Alice Smith");
  });
});
```

### Testing multi-user scenarios with callAs()

```typescript
it("supports callAs with custom context", async () => {
  const result = await testKit.callAs(
    { userId: "custom-user-123" },
    "add_contact",
    { name: "Custom User Contact" },
  );

  expect(result.isError).toBeUndefined();
});
```

### Testing error cases

```typescript
it("returns error for unknown tool", async () => {
  const result = await testKit.call("nonexistent_tool", {});
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain("Unknown tool");
});

it("validates arguments with Zod", async () => {
  const result = await testKit.call("add_contact", {});
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain("Invalid arguments");
});
```

### Catching migration errors

```typescript
import { MigrationError } from "@kitstackdev/kit";

it("throws MigrationError for invalid SQL", async () => {
  const badKit = defineKit({
    id: "bad-kit",
    version: "0.0.1",
    name: "Bad Kit",
    description: "Kit with invalid migration SQL",
    schema: {},
    migrationSql: "NOT VALID SQL AT ALL",
    instructions: "",
    tools: [someTool],
  });

  await expect(createTestKit(badKit)).rejects.toThrow(MigrationError);
});
```

### Testing view loaders

```typescript
it("loads the pipeline view", async () => {
  // Seed some data first
  await testKit.call("add_contact", { name: "Alice" });
  const rows = await testKit.db.select().from(contacts);
  await testKit.call("add_deal", {
    name: "Enterprise License",
    contactId: rows[0].id,
    value: 50000,
    stage: "proposal",
  });

  // Test the loader directly
  const data = await testKit.loadView("pipeline");
  expect(data).toBeDefined();
});
```
