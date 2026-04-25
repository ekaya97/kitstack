import type { z } from "zod";
import type { KitDefinition, ToolDefinition, ViewDefinition } from "./types";
import { KitValidationError, ToolValidationError } from "./errors";

const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function warnMissingDescribe(toolName: string, schema: z.ZodType): void {
  const def = (schema as any)?._def;
  if (!def) return;

  // Only inspect ZodObject shapes
  const shape =
    typeof def.shape === "function" ? def.shape() : def.shape;
  if (!shape || typeof shape !== "object") return;

  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    if (!(fieldSchema as any)?.description) {
      console.warn(
        `[kitstack] Warning: Tool "${toolName}" arg "${fieldName}" has no description. Add .describe() to help the LLM fill this field correctly.`
      );
    }
  }
}

export function defineKit(config: {
  id: string;
  version: string;
  name: string;
  description: string;
  schema: Record<string, unknown>;
  migrationSql: string;
  instructions: string;
  tools: ToolDefinition[];
  views?: ViewDefinition[];
}): KitDefinition {
  for (const tool of config.tools) {
    // Validate every tool has at least load() or handler()
    if (!tool.load && !tool.handler) {
      throw new ToolValidationError(
        "TOOL_MISSING_IMPL",
        `Tool "${tool.name}" must have at least a load() or handler() function. Add load() for data-fetching tools or handler() for mutation tools.`
      );
    }

    // Validate tool name is snake_case
    if (!SNAKE_CASE_RE.test(tool.name)) {
      const suggested = tool.name
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[-\s]+/g, "_")
        .toLowerCase();
      throw new ToolValidationError(
        "TOOL_INVALID_NAME",
        `Tool name "${tool.name}" must be snake_case. Use "${suggested}" instead.`
      );
    }

    // Validate tool description min length
    if (!tool.description || tool.description.length < 10) {
      throw new ToolValidationError(
        "TOOL_SHORT_DESCRIPTION",
        `Tool "${tool.name}" description is too short (${tool.description?.length ?? 0} chars, minimum 10). Descriptions help the LLM understand when and how to use the tool.`
      );
    }

    // Warn: tool description too long
    if (tool.description.length > 200) {
      console.warn(
        `[kitstack] Warning: Tool "${tool.name}" description is long (${tool.description.length} chars). Consider being more concise.`
      );
    }

    // Warn: missing .describe() on Zod args fields
    if (tool.args) {
      warnMissingDescribe(tool.name, tool.args);
    }

    // Warn: tool name contains kit ID prefix
    if (tool.name.startsWith(`${config.id}_`)) {
      const unprefixed = tool.name.slice(config.id.length + 1);
      console.warn(
        `[kitstack] Warning: Tool "${tool.name}" should not include the kit prefix. Use "${unprefixed}" — the kit context is added automatically.`
      );
    }
  }

  // Validate unique tool names
  const toolNames = config.tools.map((t) => t.name);
  const uniqueToolNames = new Set(toolNames);
  if (uniqueToolNames.size !== toolNames.length) {
    const dupes = toolNames.filter((n, i) => toolNames.indexOf(n) !== i);
    throw new KitValidationError(
      "KIT_DUPLICATE_TOOLS",
      `Kit "${config.id}" has duplicate tool names: ${dupes.join(", ")}. Each tool name must be unique within a kit.`
    );
  }

  // Validate views
  if (config.views) {
    const slugs = config.views.map((v) => v.slug);

    // Validate unique view slugs
    const uniqueSlugs = new Set(slugs);
    if (uniqueSlugs.size !== slugs.length) {
      const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
      throw new KitValidationError(
        "KIT_DUPLICATE_VIEWS",
        `Kit "${config.id}" has duplicate view slugs: ${dupes.join(", ")}. Each view slug must be unique within a kit.`
      );
    }

    // Validate view slugs are kebab-case
    for (const view of config.views) {
      if (!KEBAB_CASE_RE.test(view.slug)) {
        const suggested = view.slug
          .replace(/([a-z])([A-Z])/g, "$1-$2")
          .replace(/[_\s]+/g, "-")
          .toLowerCase();
        throw new KitValidationError(
          "KIT_INVALID_VIEW_SLUG",
          `View slug "${view.slug}" must be kebab-case. Use "${suggested}" instead.`
        );
      }
    }
  }

  return config;
}
