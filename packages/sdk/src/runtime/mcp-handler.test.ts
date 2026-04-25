import { describe, it, expect, beforeAll } from "vitest";
import { z } from "zod";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { defineTool } from "../define-tool";
import { defineKit } from "../define-kit";
import { defineView } from "../define-view";
import { defineLoader } from "../define-loader";
import { kit } from "../result";
import {
  createMcpHandler,
  type McpHandler,
  type JsonRpcRequest,
} from "./mcp-handler";

// -- Test kit with tools + views --

const addItem = defineTool({
  name: "add_item",
  description: "Add an item to the inventory",
  args: z.object({
    name: z.string().describe("Item name"),
    quantity: z.number().optional().describe("How many"),
  }),
  handler: async (db, args, ctx) => {
    const id = crypto.randomUUID();
    const qty = args.quantity ?? 1;
    await db.run(
      sql`INSERT INTO items (id, name, quantity) VALUES (${id}, ${args.name}, ${qty})`
    );
    return kit.text(`Added "${args.name}" (qty: ${qty})`);
  },
});

async function loadItems(db: any) {
  return db.all(sql`SELECT * FROM items ORDER BY name`);
}

const listItems = defineTool({
  name: "list_items",
  description: "List all items in the inventory",
  args: z.object({}),
  load: loadItems,
  handler: async (db: any) => {
    const rows = await loadItems(db);
    if (rows.length === 0) return kit.text("No items.");
    return kit.text(
      rows.map((r: any) => `${r.name}: ${r.quantity}`).join("\n")
    );
  },
});

const itemsLoader = defineLoader(async (db: any) => {
  return db.all(sql`SELECT * FROM items ORDER BY name`);
});

// Minimal view definition (component is not used in handler tests)
const itemsView = defineView({
  slug: "items",
  name: "Items",
  description: "after adding items to the inventory",
  loader: itemsLoader,
  component: (() => null) as any,
  height: 400,
});

const testKitDef = defineKit({
  id: "test-inv",
  version: "0.1.0",
  name: "Test Inventory",
  description: "Minimal kit for MCP handler tests",
  schema: {},
  migrationSql: `
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1
    );
  `,
  instructions: "Test kit.",
  tools: [addItem, listItems],
  views: [itemsView],
});

// -- Setup --

let handler: McpHandler;

beforeAll(async () => {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client);
  await client.execute(
    "CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, name TEXT NOT NULL, quantity INTEGER DEFAULT 1)"
  );
  handler = createMcpHandler({ kit: testKitDef, db });
});

// Helper to send JSON-RPC
async function rpc(method: string, params?: Record<string, unknown>) {
  const req: JsonRpcRequest = { jsonrpc: "2.0", id: 1, method, params };
  return handler.handleRequest(req);
}

function textOf(result: any): string {
  const block = result?.content?.find((c: any) => c.type === "text");
  return block?.text ?? "";
}

// -- Tests --

describe("MCP handler: two-tool split", () => {
  describe("initialize", () => {
    it("returns server info and capabilities", async () => {
      const res = await rpc("initialize");
      const result = res!.result as any;
      expect(result.protocolVersion).toBe("2025-11-25");
      expect(result.serverInfo.name).toBe("Test Inventory");
      expect(result.capabilities.tools).toEqual({});
      expect(result.capabilities.extensions["io.modelcontextprotocol/ui"]).toEqual({});
    });
  });

  describe("tools/list", () => {
    it("returns exactly two tools: kit and kit_view", async () => {
      const res = await rpc("tools/list");
      const tools = (res!.result as any).tools;
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe("kit");
      expect(tools[1].name).toBe("kit_view");
    });

    it("kit tool has no _meta (text-only)", async () => {
      const res = await rpc("tools/list");
      const kitTool = (res!.result as any).tools[0];
      expect(kitTool._meta).toBeUndefined();
    });

    it("kit_view tool has _meta.ui.resourceUri", async () => {
      const res = await rpc("tools/list");
      const viewTool = (res!.result as any).tools[1];
      expect(viewTool._meta?.ui?.resourceUri).toBe("ui://kitstack/test-inv/app");
    });

    it("kit tool description lists actions", async () => {
      const res = await rpc("tools/list");
      const kitTool = (res!.result as any).tools[0];
      expect(kitTool.description).toContain("add_item");
      expect(kitTool.description).toContain("list_items");
    });
  });

  describe("kit() — progressive discovery", () => {
    it("kit() lists available actions", async () => {
      const res = await rpc("tools/call", {
        name: "kit",
        arguments: {},
      });
      const text = textOf((res!.result as any));
      expect(text).toContain("add_item");
      expect(text).toContain("list_items");
      expect(text).toContain("Actions");
    });

    it("kit(cmd) describes parameters", async () => {
      const res = await rpc("tools/call", {
        name: "kit",
        arguments: { cmd: "add_item" },
      });
      const text = textOf((res!.result as any));
      expect(text).toContain("add_item");
      expect(text).toContain("Parameters");
      expect(text).toContain("name");
    });

    it("kit(cmd) returns error for unknown command", async () => {
      const res = await rpc("tools/call", {
        name: "kit",
        arguments: { cmd: "nonexistent" },
      });
      const result = (res!.result as any);
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("nonexistent");
    });

    it("kit(cmd, params) executes the tool", async () => {
      const res = await rpc("tools/call", {
        name: "kit",
        arguments: { cmd: "add_item", params: { name: "TestWidget" } },
      });
      const text = textOf((res!.result as any));
      expect(text).toContain("TestWidget");
    });

    it("kit(cmd, params) validates arguments", async () => {
      const res = await rpc("tools/call", {
        name: "kit",
        arguments: { cmd: "add_item", params: {} },
      });
      const result = (res!.result as any);
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("Invalid arguments");
    });

    it("kit() discover includes view guidance", async () => {
      const res = await rpc("tools/call", {
        name: "kit",
        arguments: {},
      });
      const text = textOf((res!.result as any));
      expect(text).toContain("kit_view");
      expect(text).toContain("items");
    });
  });

  describe("kit(__load_view) — view reload", () => {
    it("re-runs the loader and returns data", async () => {
      const res = await rpc("tools/call", {
        name: "kit",
        arguments: { cmd: "__load_view", params: { view: "items" } },
      });
      const text = textOf((res!.result as any));
      const parsed = JSON.parse(text);
      expect(parsed).toHaveProperty("data");
      expect(Array.isArray(parsed.data)).toBe(true);
    });

    it("returns error for unknown view slug", async () => {
      const res = await rpc("tools/call", {
        name: "kit",
        arguments: { cmd: "__load_view", params: { view: "nope" } },
      });
      const result = (res!.result as any);
      expect(result.isError).toBe(true);
    });
  });

  describe("kit_view() — embedded resource", () => {
    it("kit_view() lists available views", async () => {
      const res = await rpc("tools/call", {
        name: "kit_view",
        arguments: {},
      });
      const text = textOf((res!.result as any));
      expect(text).toContain("items");
      expect(text).toContain("Available Views");
    });

    it("kit_view(view) returns two content blocks", async () => {
      const res = await rpc("tools/call", {
        name: "kit_view",
        arguments: { view: "items" },
      });
      const result = (res!.result as any);
      expect(result.content).toHaveLength(2);
    });

    it("kit_view(view) first block is JSON data payload", async () => {
      const res = await rpc("tools/call", {
        name: "kit_view",
        arguments: { view: "items" },
      });
      const result = (res!.result as any);
      const textBlock = result.content[0];
      expect(textBlock.type).toBe("text");
      const data = JSON.parse(textBlock.text);
      expect(data.kit).toBe("test-inv");
      expect(data.view).toBe("items");
      expect(data.app).toBe("Items");
      expect(data).toHaveProperty("data");
    });

    it("kit_view(view) second block is HTML embedded resource", async () => {
      const res = await rpc("tools/call", {
        name: "kit_view",
        arguments: { view: "items" },
      });
      const result = (res!.result as any);
      const resourceBlock = result.content[1];
      expect(resourceBlock.type).toBe("resource");
      expect(resourceBlock.resource.mimeType).toBe("text/html;profile=mcp-app");
      expect(resourceBlock.resource.uri).toBe("ui://kitstack/test-inv/items");
      expect(resourceBlock.resource.text).toContain("<!DOCTYPE html>");
    });

    it("kit_view(view) returns error for unknown view", async () => {
      const res = await rpc("tools/call", {
        name: "kit_view",
        arguments: { view: "nonexistent" },
      });
      const result = (res!.result as any);
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("nonexistent");
    });
  });

  describe("unknown tools/methods", () => {
    it("rejects unknown tool names", async () => {
      const res = await rpc("tools/call", {
        name: "something_else",
        arguments: {},
      });
      expect(res!.error).toBeDefined();
      expect(res!.error!.message).toContain("something_else");
    });

    it("rejects unknown methods", async () => {
      const res = await rpc("resources/list");
      expect(res!.error).toBeDefined();
      expect(res!.error!.code).toBe(-32601);
    });

    it("returns null for notifications", async () => {
      const res = await handler.handleRequest({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
      expect(res).toBeNull();
    });
  });

  describe("callTool (direct invocation)", () => {
    it("calls a tool directly by name", async () => {
      const result = await handler.callTool("list_items", {});
      expect(result.isError).toBeUndefined();
    });

    it("returns error for unknown tool", async () => {
      const result = await handler.callTool("nope", {});
      expect(result.isError).toBe(true);
    });
  });
});
