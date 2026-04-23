import type { KitDefinition, ToolDefinition } from "./types";

export function defineKit(config: {
  id: string;
  name: string;
  description: string;
  schema: Record<string, any>;
  migrationSql: string;
  instructions: string;
  tools: ToolDefinition[];
}): KitDefinition {
  const toolNames = config.tools.map((t) => t.name);
  const uniqueNames = new Set(toolNames);
  if (uniqueNames.size !== toolNames.length) {
    throw new Error(`Kit "${config.id}" has duplicate tool names`);
  }

  return config;
}
