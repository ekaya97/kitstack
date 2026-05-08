/**
 * Converts a Zod schema to a JSON Schema object suitable for MCP tool
 * definitions. Uses `_def.typeName` instead of `instanceof` checks so
 * it works across different Zod module instances (e.g. SDK vs kit).
 */
export function zodToJsonSchema(schema: any): Record<string, unknown> {
  return processZodType(schema);
}

function processZodType(schema: any): Record<string, unknown> {
  const desc = schema?.description;
  const descProp = desc ? { description: desc } : {};
  const typeName = schema?._def?.typeName;

  if (typeName === "ZodObject") {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = processZodType(value);
      const valTypeName = (value as any)?._def?.typeName;
      if (valTypeName !== "ZodOptional" && valTypeName !== "ZodDefault") {
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

  if (typeName === "ZodString") return { type: "string", ...descProp };
  if (typeName === "ZodNumber") return { type: "number", ...descProp };
  if (typeName === "ZodBoolean") return { type: "boolean", ...descProp };

  if (typeName === "ZodArray") {
    return {
      type: "array",
      items: processZodType(schema._def.type),
      ...descProp,
    };
  }

  if (typeName === "ZodEnum") {
    return { type: "string", enum: schema._def.values, ...descProp };
  }

  if (typeName === "ZodRecord") {
    return {
      type: "object",
      additionalProperties: processZodType(schema._def.valueType),
      ...descProp,
    };
  }

  if (typeName === "ZodOptional") {
    return processZodType(schema._def.innerType);
  }

  if (typeName === "ZodDefault") {
    const defVal = schema._def.defaultValue;
    return {
      ...processZodType(schema._def.innerType),
      default: typeof defVal === "function" ? defVal() : defVal,
    };
  }

  // Fallback for unknown types
  return { type: "string", ...descProp };
}
