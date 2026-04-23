import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToJsonSchema } from "../zod-to-json-schema";

describe("zodToJsonSchema", () => {
  it("converts a simple object schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const result = zodToJsonSchema(schema);
    expect(result.type).toBe("object");
    expect((result.properties as any).name.type).toBe("string");
    expect((result.properties as any).age.type).toBe("number");
    expect(result.required).toEqual(["name", "age"]);
  });

  it("handles optional fields", () => {
    const schema = z.object({
      name: z.string(),
      email: z.string().optional(),
    });
    const result = zodToJsonSchema(schema);
    expect(result.required).toEqual(["name"]);
  });

  it("handles defaults", () => {
    const schema = z.object({
      limit: z.number().optional().default(20),
    });
    const result = zodToJsonSchema(schema);
    expect((result.properties as any).limit.default).toBe(20);
  });

  it("handles arrays", () => {
    const schema = z.object({
      tags: z.array(z.string()),
    });
    const result = zodToJsonSchema(schema);
    expect((result.properties as any).tags.type).toBe("array");
    expect((result.properties as any).tags.items.type).toBe("string");
  });

  it("handles enums", () => {
    const schema = z.object({
      status: z.enum(["open", "done"]),
    });
    const result = zodToJsonSchema(schema);
    expect((result.properties as any).status.enum).toEqual(["open", "done"]);
  });

  it("preserves descriptions", () => {
    const schema = z.object({
      name: z.string().describe("The contact name"),
    });
    const result = zodToJsonSchema(schema);
    expect((result.properties as any).name.description).toBe("The contact name");
  });

  it("converts a real tool schema", () => {
    const schema = z.object({
      title: z.string().describe("Meeting title"),
      date: z.string().describe("YYYY-MM-DD"),
      attendees: z.array(z.string()),
      notes: z.string(),
    });
    const result = zodToJsonSchema(schema);
    expect(result.type).toBe("object");
    expect(result.required).toEqual(["title", "date", "attendees", "notes"]);
    expect((result.properties as any).attendees.type).toBe("array");
  });
});
