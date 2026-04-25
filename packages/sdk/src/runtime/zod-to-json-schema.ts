import { z } from "zod";

/**
 * Converts a Zod schema to a JSON Schema object suitable for MCP tool
 * definitions. This is used at build time and by the MCP handler at runtime
 * to serialize tool argument schemas into the JSON Schema format that MCP
 * clients (Claude, etc.) understand.
 *
 * **Supported Zod types:**
 * - `z.object()` -- emits `{ type: "object", properties, required }`
 * - `z.string()` -- emits `{ type: "string" }`
 * - `z.number()` -- emits `{ type: "number" }`
 * - `z.boolean()` -- emits `{ type: "boolean" }`
 * - `z.array()` -- emits `{ type: "array", items }`
 * - `z.enum()` -- emits `{ type: "string", enum: [...] }`
 * - `z.record()` -- emits `{ type: "object", additionalProperties }`
 * - `z.optional()` -- unwraps and omits from `required` array
 * - `z.default()` -- unwraps and adds `default` value to output
 *
 * Any unrecognized Zod type falls back to `{ type: "string" }`.
 *
 * Descriptions added via `.describe()` are preserved as the `description`
 * property in the JSON Schema output — this is critical for LLM tool usage
 * since the description tells the model what to put in each field.
 *
 * @param schema - A Zod schema (typically `z.object(...)` for tool args).
 * @returns A plain JSON Schema object.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { zodToJsonSchema } from "@kitstack/sdk/runtime/zod-to-json-schema";
 *
 * // Schema from the CRM kit's add_contact tool
 * const args = z.object({
 *   name: z.string().describe("Contact's full name"),
 *   company: z.string().optional().describe("Company name"),
 *   email: z.string().optional().describe("Email address"),
 * });
 *
 * const jsonSchema = zodToJsonSchema(args);
 * // => {
 * //   type: "object",
 * //   properties: {
 * //     name: { type: "string", description: "Contact's full name" },
 * //     company: { type: "string", description: "Company name" },
 * //     email: { type: "string", description: "Email address" },
 * //   },
 * //   required: ["name"],
 * // }
 * ```
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
      if (
        !(value instanceof z.ZodOptional) &&
        !(value instanceof z.ZodDefault)
      ) {
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
    return {
      type: "array",
      items: processZodType((schema as any).element),
      ...descProp,
    };
  }

  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: schema.options, ...descProp };
  }

  if (schema instanceof z.ZodRecord) {
    return {
      type: "object",
      additionalProperties: processZodType((schema as any)._def.valueType),
      ...descProp,
    };
  }

  if (schema instanceof z.ZodOptional) {
    return processZodType((schema as any).unwrap());
  }

  if (schema instanceof z.ZodDefault) {
    return {
      ...processZodType((schema as any).removeDefault()),
      default:
        typeof (schema as any)._def.defaultValue === "function"
          ? (schema as any)._def.defaultValue()
          : (schema as any)._def.defaultValue,
    };
  }

  // Fallback for unknown types
  return { type: "string", ...descProp };
}
