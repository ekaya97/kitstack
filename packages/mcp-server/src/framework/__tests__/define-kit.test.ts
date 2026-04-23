import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineKit } from "../define-kit";
import { defineTool } from "../define-tool";

const dummyTool = defineTool({
  name: "test_tool",
  description: "A test tool",
  args: z.object({ input: z.string() }),
  handler: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
});

describe("defineKit", () => {
  it("returns a valid kit definition", () => {
    const kit = defineKit({
      id: "test-kit",
      name: "Test Kit",
      description: "A test kit",
      schema: {},
      migrationSql: "CREATE TABLE test (id TEXT PRIMARY KEY);",
      instructions: "Test instructions",
      tools: [dummyTool],
    });

    expect(kit.id).toBe("test-kit");
    expect(kit.tools).toHaveLength(1);
    expect(kit.tools[0].name).toBe("test_tool");
  });

  it("throws on duplicate tool names", () => {
    const duplicateTool = defineTool({
      name: "test_tool",
      description: "Duplicate",
      args: z.object({}),
      handler: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
    });

    expect(() =>
      defineKit({
        id: "dup-kit",
        name: "Dup Kit",
        description: "Duplicate tools",
        schema: {},
        migrationSql: "",
        instructions: "",
        tools: [dummyTool, duplicateTool],
      })
    ).toThrow("duplicate tool names");
  });
});
