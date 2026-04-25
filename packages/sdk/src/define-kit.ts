import type { KitDefinition, ToolDefinition, ViewDefinition } from "./types";
import { KitValidationError, ToolValidationError } from "./errors";

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
  // Validate every tool has at least load() or handler()
  for (const tool of config.tools) {
    if (!tool.load && !tool.handler) {
      throw new ToolValidationError(
        "TOOL_MISSING_IMPL",
        `Tool "${tool.name}" must have at least a load() or handler() function. Add load() for data-fetching tools or handler() for mutation tools.`
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

  // Validate unique view slugs
  if (config.views) {
    const slugs = config.views.map((v) => v.slug);
    const uniqueSlugs = new Set(slugs);
    if (uniqueSlugs.size !== slugs.length) {
      const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
      throw new KitValidationError(
        "KIT_DUPLICATE_VIEWS",
        `Kit "${config.id}" has duplicate view slugs: ${dupes.join(", ")}. Each view slug must be unique within a kit.`
      );
    }
  }

  return config;
}
