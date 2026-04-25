import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { createTestKit } from "../src/testing/index";
import { defineTool } from "../src/define-tool";
import { defineKit } from "../src/define-kit";
import { defineView } from "../src/define-view";
import { defineLoader } from "../src/define-loader";
import { kit } from "../src/result";
import {
  createMcpHandler,
  type JsonRpcRequest,
} from "../src/runtime/mcp-handler";

// -- Tool with authorize hook --

const protectedTool = defineTool({
  name: "delete_item",
  description: "Delete an item (requires owner relation)",
  args: z.object({ itemId: z.string().describe("Item ID") }),
  authorize: (args, ctx) => [
    { relation: "owner", objectType: "item", objectId: args.itemId },
  ],
  handler: async () => kit.text("Deleted."),
});

const multiAuthTool = defineTool({
  name: "transfer_item",
  description: "Transfer item ownership (requires two relations)",
  args: z.object({
    itemId: z.string().describe("Item to transfer"),
    targetId: z.string().describe("Target user"),
  }),
  authorize: (args, ctx) => [
    { relation: "owner", objectType: "item", objectId: args.itemId },
    { relation: "admin", objectType: "org", objectId: "default" },
  ],
  handler: async () => kit.text("Transferred."),
});

const publicTool = defineTool({
  name: "list_items",
  description: "List items (no authorization required)",
  args: z.object({}),
  handler: async () => kit.text("Items listed."),
});

const testKitDef = defineKit({
  id: "authz-test",
  version: "0.1.0",
  name: "AuthZ Test Kit",
  description: "Kit for testing authorize hooks",
  schema: {},
  migrationSql: "CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY);",
  instructions: "",
  tools: [protectedTool, multiAuthTool, publicTool],
});

// -- createTestKit authorize tests --

describe("createTestKit — authorize hook", () => {
  it("allows call when checkAuthz returns true", async () => {
    const testKit = await createTestKit(testKitDef, {
      checkAuthz: async () => true,
    });
    const result = await testKit.call("delete_item", { itemId: "abc" });
    expect(result.isError).toBeUndefined();
    expect((result.content[0] as any).text).toBe("Deleted.");
    await testKit.cleanup();
  });

  it("rejects call when checkAuthz returns false", async () => {
    const testKit = await createTestKit(testKitDef, {
      checkAuthz: async () => false,
    });
    const result = await testKit.call("delete_item", { itemId: "abc" });
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).toContain("Forbidden");
    expect((result.content[0] as any).text).toContain("owner");
    expect((result.content[0] as any).text).toContain("abc");
    await testKit.cleanup();
  });

  it("skips authorize when no checkAuthz is provided", async () => {
    const testKit = await createTestKit(testKitDef);
    const result = await testKit.call("delete_item", { itemId: "abc" });
    expect(result.isError).toBeUndefined();
    expect((result.content[0] as any).text).toBe("Deleted.");
    await testKit.cleanup();
  });

  it("passes correct requirement to checkAuthz", async () => {
    const requirements: any[] = [];
    const testKit = await createTestKit(testKitDef, {
      checkAuthz: async (_db, req, ctx) => {
        requirements.push({ ...req, userId: ctx.userId });
        return true;
      },
    });
    await testKit.call("delete_item", { itemId: "item-99" });
    expect(requirements).toHaveLength(1);
    expect(requirements[0]).toEqual({
      relation: "owner",
      objectType: "item",
      objectId: "item-99",
      userId: "test-user",
    });
    await testKit.cleanup();
  });

  it("checks all requirements — first failure rejects", async () => {
    let callCount = 0;
    const testKit = await createTestKit(testKitDef, {
      checkAuthz: async (_db, req) => {
        callCount++;
        return req.relation === "owner"; // owner passes, admin fails
      },
    });
    const result = await testKit.call("transfer_item", {
      itemId: "x",
      targetId: "y",
    });
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).toContain("admin");
    expect(callCount).toBe(2);
    await testKit.cleanup();
  });

  it("does not run authorize on tools without the hook", async () => {
    let called = false;
    const testKit = await createTestKit(testKitDef, {
      checkAuthz: async () => {
        called = true;
        return true;
      },
    });
    await testKit.call("list_items");
    expect(called).toBe(false);
    await testKit.cleanup();
  });
});

// -- MCP handler authorize tests --

describe("MCP handler — authorize hook", () => {
  async function setupHandler(checkAuthz?: any) {
    const client = createClient({ url: ":memory:" });
    const db = drizzle(client);
    await client.execute("CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY)");
    return createMcpHandler({ kit: testKitDef, db, checkAuthz });
  }

  it("evaluates authorize when checkAuthz is configured", async () => {
    const handler = await setupHandler(async () => false);
    const res = await handler.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "kit",
        arguments: { cmd: "delete_item", params: { itemId: "x" } },
      },
    });
    const result = (res!.result as any);
    expect(result.isError).toBe(true);
    expect((result.content[0] as any).text).toContain("Forbidden");
  });

  it("skips authorize when checkAuthz is not configured", async () => {
    const handler = await setupHandler();
    const res = await handler.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "kit",
        arguments: { cmd: "delete_item", params: { itemId: "x" } },
      },
    });
    const result = (res!.result as any);
    expect(result.isError).toBeUndefined();
  });

  it("allows when checkAuthz returns true", async () => {
    const handler = await setupHandler(async () => true);
    const result = await handler.callTool("delete_item", { itemId: "x" });
    expect(result.isError).toBeUndefined();
    expect((result.content[0] as any).text).toBe("Deleted.");
  });
});
