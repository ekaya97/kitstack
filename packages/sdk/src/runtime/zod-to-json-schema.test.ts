import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToJsonSchema } from "./zod-to-json-schema";

describe("zodToJsonSchema", () => {
  describe("primitives", () => {
    it("z.string() → { type: string }", () => {
      expect(zodToJsonSchema(z.string())).toEqual({ type: "string" });
    });

    it("z.number() → { type: number }", () => {
      expect(zodToJsonSchema(z.number())).toEqual({ type: "number" });
    });

    it("z.boolean() → { type: boolean }", () => {
      expect(zodToJsonSchema(z.boolean())).toEqual({ type: "boolean" });
    });
  });

  describe("descriptions", () => {
    it("propagates .describe() to description field", () => {
      const schema = z.string().describe("A person's name");
      expect(zodToJsonSchema(schema)).toEqual({
        type: "string",
        description: "A person's name",
      });
    });
  });

  describe("z.object", () => {
    it("converts flat object with required and optional fields", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      });
      const result = zodToJsonSchema(schema);
      expect(result.type).toBe("object");
      expect(result.properties).toEqual({
        name: { type: "string" },
        age: { type: "number" },
      });
      expect(result.required).toEqual(["name"]);
    });

    it("omits required array when all fields are optional", () => {
      const schema = z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
      });
      const result = zodToJsonSchema(schema);
      expect(result.required).toBeUndefined();
    });

    it("handles empty object", () => {
      const result = zodToJsonSchema(z.object({}));
      expect(result).toEqual({ type: "object", properties: {} });
    });
  });

  describe("z.array", () => {
    it("converts array of strings", () => {
      const result = zodToJsonSchema(z.array(z.string()));
      expect(result).toEqual({
        type: "array",
        items: { type: "string" },
      });
    });

    it("converts array of objects", () => {
      const result = zodToJsonSchema(z.array(z.object({ id: z.string() })));
      expect(result.type).toBe("array");
      expect((result.items as any).type).toBe("object");
    });
  });

  describe("z.enum", () => {
    it("converts to string with enum values", () => {
      const result = zodToJsonSchema(z.enum(["draft", "sent", "accepted"]));
      expect(result).toEqual({
        type: "string",
        enum: ["draft", "sent", "accepted"],
      });
    });
  });

  describe("z.optional", () => {
    it("unwraps optional — schema is the inner type", () => {
      const result = zodToJsonSchema(z.string().optional());
      expect(result).toEqual({ type: "string" });
    });
  });

  describe("z.default", () => {
    it("includes default value", () => {
      const result = zodToJsonSchema(z.number().default(25));
      expect(result).toEqual({ type: "number", default: 25 });
    });

    it("handles string default", () => {
      const result = zodToJsonSchema(z.string().default("hello"));
      expect(result).toEqual({ type: "string", default: "hello" });
    });
  });

  describe("z.record", () => {
    it("converts record to object with additionalProperties", () => {
      const result = zodToJsonSchema(z.record(z.string(), z.number()));
      expect(result).toEqual({
        type: "object",
        additionalProperties: { type: "number" },
      });
    });
  });

  describe("nested objects", () => {
    it("handles nested z.object", () => {
      const schema = z.object({
        address: z.object({
          street: z.string(),
          city: z.string(),
        }),
      });
      const result = zodToJsonSchema(schema);
      const address = (result.properties as any).address;
      expect(address.type).toBe("object");
      expect(address.properties.street).toEqual({ type: "string" });
      expect(address.properties.city).toEqual({ type: "string" });
    });
  });

  describe("complex real-world schema", () => {
    it("converts a CRM-like add_contact schema", () => {
      // Note: .describe() must come before .optional() for the converter
      // to preserve the description — optional unwraps to the inner type.
      const schema = z.object({
        name: z.string().describe("Contact's full name"),
        company: z.string().describe("Company name").optional(),
        email: z.string().describe("Email address").optional(),
        tags: z.array(z.string()).describe("Tags").optional(),
      });

      const result = zodToJsonSchema(schema);
      expect(result.type).toBe("object");
      expect(result.required).toEqual(["name"]);
      expect((result.properties as any).name).toEqual({
        type: "string",
        description: "Contact's full name",
      });
      expect((result.properties as any).company).toEqual({
        type: "string",
        description: "Company name",
      });
      expect((result.properties as any).tags).toEqual({
        type: "array",
        items: { type: "string" },
        description: "Tags",
      });
    });
  });
});
