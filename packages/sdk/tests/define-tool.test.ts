import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineTool } from "../src/define-tool";
import { kit } from "../src/result";
import type { KitContext } from "../src/types";

const ctx = {} as KitContext;

describe("defineTool", () => {
  describe("load-only tool", () => {
    it("auto-generates a handler that returns kit.json(data)", async () => {
      const tool = defineTool({
        name: "list_items",
        description: "List all items in inventory",
        args: z.object({}),
        load: async () => [{ id: "1", name: "Widget" }],
      });

      expect(tool.handler).toBeDefined();
      const result = await tool.handler!(ctx, {});
      const block = result.content[0] as { type: "text"; text: string };
      const data = JSON.parse(block.text);
      expect(data).toEqual([{ id: "1", name: "Widget" }]);
      expect(result.isError).toBeUndefined();
    });

    it("preserves the load function", async () => {
      const loadFn = async () => ({ count: 42 });
      const tool = defineTool({
        name: "get_count",
        description: "Get the item count from DB",
        args: z.object({}),
        load: loadFn,
      });

      expect(tool.load).toBe(loadFn);
    });
  });

  describe("handler-only tool", () => {
    it("returns the handler as-is", async () => {
      const handlerFn = async () => kit.text("done");
      const tool = defineTool({
        name: "do_thing",
        description: "Perform an action on the system",
        args: z.object({}),
        handler: handlerFn,
      });

      expect(tool.handler).toBe(handlerFn);
      expect(tool.load).toBeUndefined();
    });
  });

  describe("load + handler tool", () => {
    it("does not overwrite the explicit handler", async () => {
      const handlerFn = async () => kit.text("custom output");
      const tool = defineTool({
        name: "list_items",
        description: "List all items with custom formatting",
        args: z.object({}),
        load: async () => [1, 2, 3],
        handler: handlerFn,
      });

      expect(tool.handler).toBe(handlerFn);
      const result = await tool.handler!(ctx, {});
      expect((result.content[0] as { type: "text"; text: string }).text).toBe("custom output");
    });

    it("keeps load accessible for loaders", async () => {
      const tool = defineTool({
        name: "list_items",
        description: "List all items with typed data",
        args: z.object({ limit: z.number().optional() }),
        load: async (_ctx: KitContext, args: any) => Array(args.limit ?? 10).fill(null),
        handler: async () => kit.text("table here"),
      });

      const data = await tool.load(ctx, { limit: 3 });
      expect(data).toHaveLength(3);
    });
  });

  it("passes through name, description, and args", () => {
    const args = z.object({ name: z.string() });
    const tool = defineTool({
      name: "add_item",
      description: "Add a new item to the inventory",
      args,
      handler: async () => kit.text("ok"),
    });

    expect(tool.name).toBe("add_item");
    expect(tool.description).toBe("Add a new item to the inventory");
    expect(tool.args).toBe(args);
  });
});
