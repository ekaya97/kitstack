import { describe, it, expect } from "vitest";
import { kit } from "../src/result";

describe("kit.text", () => {
  it("returns a text content block", () => {
    const result = kit.text("hello world");
    expect(result).toEqual({
      content: [{ type: "text", text: "hello world" }],
    });
  });

  it("does not set isError", () => {
    expect(kit.text("ok").isError).toBeUndefined();
  });
});

describe("kit.error", () => {
  it("returns a text content block with isError true", () => {
    const result = kit.error("something broke");
    expect(result.content[0]).toEqual({ type: "text", text: "something broke" });
    expect(result.isError).toBe(true);
  });
});

describe("kit.json", () => {
  it("returns pretty-printed JSON as text", () => {
    const data = { id: "abc", count: 3 };
    const result = kit.json(data);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse((result.content[0] as any).text)).toEqual(data);
  });

  it("handles arrays", () => {
    const result = kit.json([1, 2, 3]);
    expect(JSON.parse((result.content[0] as any).text)).toEqual([1, 2, 3]);
  });

  it("handles null", () => {
    const result = kit.json(null);
    expect((result.content[0] as any).text).toBe("null");
  });

  it("does not set isError", () => {
    expect(kit.json({}).isError).toBeUndefined();
  });
});

describe("kit.notFound", () => {
  it("includes entity and id in message", () => {
    const result = kit.notFound("contact", "abc123");
    expect((result.content[0] as any).text).toBe('contact with id "abc123" not found');
    expect(result.isError).toBe(true);
  });
});

describe("kit.validationError", () => {
  it("prefixes with Validation error:", () => {
    const result = kit.validationError("name is required");
    expect((result.content[0] as any).text).toBe("Validation error: name is required");
    expect(result.isError).toBe(true);
  });
});

describe("kit.conflict", () => {
  it("prefixes with Conflict:", () => {
    const result = kit.conflict("deal is archived");
    expect((result.content[0] as any).text).toBe("Conflict: deal is archived");
    expect(result.isError).toBe(true);
  });
});
