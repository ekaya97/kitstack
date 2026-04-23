import { z } from "zod";

/**
 * Converts a Zod schema to a JSON Schema object suitable for MCP tool definitions.
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return processZodType(schema);
}

function processZodType(schema: z.ZodType): Record<string, unknown> {
  const desc = schema.description;
  const descProp = desc ? { description: desc } : {};

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = processZodType(value as z.ZodType);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
      ...descProp,
    };
  }

  if (schema instanceof z.ZodString) return { type: "string", ...descProp };
  if (schema instanceof z.ZodNumber) return { type: "number", ...descProp };
  if (schema instanceof z.ZodBoolean) return { type: "boolean", ...descProp };

  if (schema instanceof z.ZodArray) {
    return { type: "array", items: processZodType(schema.element), ...descProp };
  }

  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: schema.options, ...descProp };
  }

  if (schema instanceof z.ZodOptional) {
    return processZodType(schema.unwrap());
  }

  if (schema instanceof z.ZodDefault) {
    return {
      ...processZodType(schema.removeDefault()),
      default: typeof schema._def.defaultValue === "function"
        ? schema._def.defaultValue()
        : schema._def.defaultValue,
    };
  }

  return { type: "string", ...descProp };
}
