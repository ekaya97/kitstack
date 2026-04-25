import type { KitDefinition, ToolDefinition, ViewDefinition } from "./types";

export function defineKit(config: {
  id: string;
  name: string;
  description: string;
  schema: Record<string, unknown>;
  migrationSql: string;
  instructions: string;
  tools: ToolDefinition[];
  views?: ViewDefinition[];
}): KitDefinition {
  // Validate unique tool names
  const toolNames = config.tools.map((t) => t.name);
  const uniqueToolNames = new Set(toolNames);
  if (uniqueToolNames.size !== toolNames.length) {
    const dupes = toolNames.filter((n, i) => toolNames.indexOf(n) !== i);
    throw new Error(`Kit "${config.id}" has duplicate tool names: ${dupes.join(", ")}`);
  }

  // Validate unique view slugs
  if (config.views) {
    const slugs = config.views.map((v) => v.slug);
    const uniqueSlugs = new Set(slugs);
    if (uniqueSlugs.size !== slugs.length) {
      const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
      throw new Error(`Kit "${config.id}" has duplicate view slugs: ${dupes.join(", ")}`);
    }
  }

  return config;
}
