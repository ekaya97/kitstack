import { describe, it, expect } from "vitest";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { createTestKit } from "../src/testing/index";
import { defineTool } from "../src/define-tool";
import { defineKit } from "../src/define-kit";
import { defineView } from "../src/define-view";
import { defineLoader } from "../src/define-loader";
import { kit } from "../src/result";

const addItem = defineTool({
  name: "add_item",
  description: "Add an item to the inventory",
  args: z.object({ name: z.string().describe("Item name") }),
  handler: async (db, args) => {
    await db.run(
      sql`INSERT INTO items (id, name, owner) VALUES (${crypto.randomUUID()}, ${args.name}, 'test-user')`
    );
    return kit.text("Added.");
  },
});

const itemsLoader = defineLoader(async (db, ctx) => {
  return db.all(sql`SELECT * FROM items WHERE owner = ${ctx.userId} ORDER BY name`);
});

const itemsView = defineView({
  slug: "items",
  name: "Items",
  description: "view all items in the inventory",
  loader: itemsLoader,
  component: (() => null) as any,
});

const testKitDef = defineKit({
  id: "view-test",
  version: "0.1.0",
  name: "View Test Kit",
  description: "Kit for testing loadView",
  schema: {},
  migrationSql: `
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner TEXT
    );
  `,
  instructions: "",
  tools: [addItem],
  views: [itemsView],
});

describe("TestKit.loadView", () => {
  it("returns loader data for a valid slug", async () => {
    const testKit = await createTestKit(testKitDef);
    await testKit.call("add_item", { name: "Widget" });
    await testKit.call("add_item", { name: "Gadget" });

    const data = (await testKit.loadView("items")) as any[];
    expect(data).toHaveLength(2);
    expect(data.map((d: any) => d.name).sort()).toEqual(["Gadget", "Widget"]);
    await testKit.cleanup();
  });

  it("throws for unknown view slug", async () => {
    const testKit = await createTestKit(testKitDef);
    await expect(testKit.loadView("nonexistent")).rejects.toThrow("Unknown view");
    await testKit.cleanup();
  });

  it("uses default context (test-user)", async () => {
    const testKit = await createTestKit(testKitDef);
    await testKit.call("add_item", { name: "Mine" });

    const data = (await testKit.loadView("items")) as any[];
    expect(data).toHaveLength(1);
    expect(data[0].owner).toBe("test-user");
    await testKit.cleanup();
  });

  it("accepts custom context override", async () => {
    const testKit = await createTestKit(testKitDef);
    // Insert with default user
    await testKit.call("add_item", { name: "DefaultItem" });

    // loadView with different userId — should return empty (no items for "alice")
    const data = (await testKit.loadView("items", { userId: "alice" })) as any[];
    expect(data).toHaveLength(0);
    await testKit.cleanup();
  });

  it("returns empty array when no data exists", async () => {
    const testKit = await createTestKit(testKitDef);
    const data = (await testKit.loadView("items")) as any[];
    expect(data).toEqual([]);
    await testKit.cleanup();
  });
});
