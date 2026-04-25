import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { defineKit } from "../src/define-kit";
import { ToolValidationError, KitValidationError } from "../src/errors";
import { kit } from "../src/result";

// Helper: minimal valid tool
function tool(overrides: Record<string, any> = {}) {
  return {
    name: "list_items",
    description: "List all items in the inventory",
    args: z.object({}),
    handler: async () => kit.text("ok"),
    ...overrides,
  } as any;
}

// Helper: minimal valid kit config
function kitConfig(overrides: Record<string, any> = {}) {
  return {
    id: "test",
    version: "0.1.0",
    name: "Test Kit",
    description: "A test kit",
    schema: {},
    migrationSql: "CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY);",
    instructions: "Test instructions.",
    tools: [tool()],
    ...overrides,
  };
}

describe("defineKit — tool name validation", () => {
  it("accepts valid snake_case names", () => {
    expect(() => defineKit(kitConfig({ tools: [tool({ name: "add_contact" })] }))).not.toThrow();
    expect(() => defineKit(kitConfig({ tools: [tool({ name: "list_deals" })] }))).not.toThrow();
    expect(() => defineKit(kitConfig({ tools: [tool({ name: "x" })] }))).not.toThrow();
    expect(() => defineKit(kitConfig({ tools: [tool({ name: "a2b" })] }))).not.toThrow();
  });

  it("rejects camelCase names", () => {
    expect(() => defineKit(kitConfig({ tools: [tool({ name: "addContact" })] })))
      .toThrow(ToolValidationError);
  });

  it("suggests snake_case fix in error message", () => {
    try {
      defineKit(kitConfig({ tools: [tool({ name: "listContacts" })] }));
    } catch (e: any) {
      expect(e.message).toContain("list_contacts");
      expect(e.code).toBe("TOOL_INVALID_NAME");
    }
  });

  it("rejects kebab-case names", () => {
    expect(() => defineKit(kitConfig({ tools: [tool({ name: "add-contact" })] })))
      .toThrow(ToolValidationError);
  });

  it("rejects names with uppercase", () => {
    expect(() => defineKit(kitConfig({ tools: [tool({ name: "Add_contact" })] })))
      .toThrow(ToolValidationError);
  });

  it("rejects names starting with a number", () => {
    expect(() => defineKit(kitConfig({ tools: [tool({ name: "2fast" })] })))
      .toThrow(ToolValidationError);
  });
});

describe("defineKit — tool description validation", () => {
  it("accepts descriptions >= 10 chars", () => {
    expect(() => defineKit(kitConfig({ tools: [tool({ description: "0123456789" })] }))).not.toThrow();
  });

  it("rejects descriptions < 10 chars", () => {
    expect(() => defineKit(kitConfig({ tools: [tool({ description: "short" })] })))
      .toThrow(ToolValidationError);
  });

  it("rejects empty description", () => {
    expect(() => defineKit(kitConfig({ tools: [tool({ description: "" })] })))
      .toThrow(ToolValidationError);
  });

  it("error code is TOOL_SHORT_DESCRIPTION", () => {
    try {
      defineKit(kitConfig({ tools: [tool({ description: "tiny" })] }));
    } catch (e: any) {
      expect(e.code).toBe("TOOL_SHORT_DESCRIPTION");
    }
  });

  it("warns on descriptions > 200 chars", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    defineKit(kitConfig({ tools: [tool({ description: "x".repeat(201) })] }));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("201 chars"));
    spy.mockRestore();
  });
});

describe("defineKit — tool implementation validation", () => {
  it("rejects tool with neither load nor handler", () => {
    const noImpl = { name: "bad_tool", description: "A tool with no implementation", args: z.object({}) } as any;
    expect(() => defineKit(kitConfig({ tools: [noImpl] })))
      .toThrow(ToolValidationError);
  });

  it("error code is TOOL_MISSING_IMPL", () => {
    const noImpl = { name: "bad_tool", description: "A tool with no implementation", args: z.object({}) } as any;
    try {
      defineKit(kitConfig({ tools: [noImpl] }));
    } catch (e: any) {
      expect(e.code).toBe("TOOL_MISSING_IMPL");
    }
  });
});

describe("defineKit — duplicate tool names", () => {
  it("rejects duplicate tool names", () => {
    const t1 = tool({ name: "add_item" });
    const t2 = tool({ name: "add_item", description: "Second add item tool" });
    expect(() => defineKit(kitConfig({ tools: [t1, t2] })))
      .toThrow(KitValidationError);
  });

  it("error code is KIT_DUPLICATE_TOOLS", () => {
    const t1 = tool({ name: "add_item" });
    const t2 = tool({ name: "add_item", description: "Another add item" });
    try {
      defineKit(kitConfig({ tools: [t1, t2] }));
    } catch (e: any) {
      expect(e.code).toBe("KIT_DUPLICATE_TOOLS");
    }
  });

  it("allows different tool names", () => {
    const t1 = tool({ name: "add_item" });
    const t2 = tool({ name: "list_items" });
    expect(() => defineKit(kitConfig({ tools: [t1, t2] }))).not.toThrow();
  });
});

describe("defineKit — view slug validation", () => {
  const view = (slug: string) => ({
    slug,
    name: "Test View",
    description: "A test view for validation",
    loader: async () => ({}),
    component: (() => null) as any,
  });

  it("accepts valid kebab-case slugs", () => {
    expect(() => defineKit(kitConfig({ views: [view("pipeline")] }))).not.toThrow();
    expect(() => defineKit(kitConfig({ views: [view("contact-detail")] }))).not.toThrow();
    expect(() => defineKit(kitConfig({ views: [view("a1-b2")] }))).not.toThrow();
  });

  it("rejects camelCase slugs", () => {
    expect(() => defineKit(kitConfig({ views: [view("contactDetail")] })))
      .toThrow(KitValidationError);
  });

  it("suggests kebab-case fix", () => {
    try {
      defineKit(kitConfig({ views: [view("contactDetail")] }));
    } catch (e: any) {
      expect(e.message).toContain("contact-detail");
      expect(e.code).toBe("KIT_INVALID_VIEW_SLUG");
    }
  });

  it("rejects snake_case slugs", () => {
    expect(() => defineKit(kitConfig({ views: [view("contact_detail")] })))
      .toThrow(KitValidationError);
  });

  it("rejects duplicate view slugs", () => {
    expect(() => defineKit(kitConfig({ views: [view("pipeline"), view("pipeline")] })))
      .toThrow(KitValidationError);
  });

  it("duplicate slug error code is KIT_DUPLICATE_VIEWS", () => {
    try {
      defineKit(kitConfig({ views: [view("pipeline"), view("pipeline")] }));
    } catch (e: any) {
      expect(e.code).toBe("KIT_DUPLICATE_VIEWS");
    }
  });
});

describe("defineKit — warnings", () => {
  it("warns when tool name has kit ID prefix", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    defineKit(kitConfig({
      id: "crm",
      tools: [tool({ name: "crm_add_contact" })],
    }));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("should not include the kit prefix"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("add_contact"));
    spy.mockRestore();
  });

  it("warns when Zod args fields lack .describe()", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    defineKit(kitConfig({
      tools: [tool({ args: z.object({ name: z.string() }) })],
    }));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('arg "name" has no description'));
    spy.mockRestore();
  });

  it("does not warn when Zod args fields have .describe()", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    defineKit(kitConfig({
      tools: [tool({ args: z.object({ name: z.string().describe("The name") }) })],
    }));
    const describeWarnings = spy.mock.calls.filter(c =>
      typeof c[0] === "string" && c[0].includes("has no description")
    );
    expect(describeWarnings).toHaveLength(0);
    spy.mockRestore();
  });
});

describe("defineKit — return value", () => {
  it("returns the config as KitDefinition", () => {
    const config = kitConfig();
    const result = defineKit(config);
    expect(result.id).toBe("test");
    expect(result.name).toBe("Test Kit");
    expect(result.tools).toHaveLength(1);
  });
});
