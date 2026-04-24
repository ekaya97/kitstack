import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { defineKit } from "../define-kit";
import { defineTool } from "../define-tool";
import { createKitHandler } from "../kit-runtime";
import { createKitTestDb } from "../../test/create-kit-test-db";
import type { KitToolInvocation } from "../types";

const migrationSql = "CREATE TABLE items (id TEXT PRIMARY KEY, value TEXT NOT NULL);";

let testDb: Awaited<ReturnType<typeof createKitTestDb>>;

vi.mock("../kit-db", () => ({
  createKitDbClient: () => testDb,
}));

beforeEach(async () => {
  testDb = await createKitTestDb(migrationSql);
});

const testKit = defineKit({
  id: "test-kit",
  name: "Test Kit",
  description: "Test",
  schema: {},
  migrationSql,
  instructions: "You are the test kit. Be helpful.",
  tools: [
    defineTool({
      name: "add_item",
      description: "Add an item",
      args: z.object({ id: z.string(), value: z.string() }),
      handler: async (db, args) => {
        await db.run(sql`INSERT INTO items (id, value) VALUES (${args.id}, ${args.value})`);
        return { content: [{ type: "text" as const, text: `Added item ${args.id}` }] };
      },
    }),
  ],
});

function makeInvocation(overrides: Partial<KitToolInvocation> = {}): KitToolInvocation {
  return {
    toolName: "add_item",
    args: { id: "1", value: "test" },
    userId: "user-1",
    kitId: "test-kit",
    dbUrl: ":memory:",
    dbToken: "",
    ...overrides,
  };
}

describe("createKitHandler", () => {
  it("dispatches to the correct tool", async () => {
    const handler = createKitHandler(testKit);
    const result = await handler(makeInvocation());
    const block = result.content[0];
    expect(block.type).toBe("text");
    if (block.type === "text") expect(block.text).toContain("Added item 1");
    expect(result.isError).toBeUndefined();
  });

  it("returns instructions for the meta-tool", async () => {
    const handler = createKitHandler(testKit);
    const result = await handler(
      makeInvocation({ toolName: "kitstack_test-kit_instructions", args: {} })
    );
    const block = result.content[0];
    if (block.type === "text") expect(block.text).toContain("You are the test kit");
  });

  it("returns error for unknown tool", async () => {
    const handler = createKitHandler(testKit);
    const result = await handler(makeInvocation({ toolName: "nonexistent" }));
    expect(result.isError).toBe(true);
    const block = result.content[0];
    if (block.type === "text") expect(block.text).toContain("Unknown tool");
  });

  it("validates args with Zod and returns error on invalid", async () => {
    const handler = createKitHandler(testKit);
    const result = await handler(
      makeInvocation({ args: { id: 123, value: null } })
    );
    expect(result.isError).toBe(true);
    const block = result.content[0];
    if (block.type === "text") expect(block.text).toContain("Invalid arguments");
  });
});
