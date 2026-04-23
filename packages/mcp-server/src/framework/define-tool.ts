import type { z } from "zod";
import type { ToolDefinition, KitToolResult } from "./types";

export function defineTool<T extends z.ZodType>(config: {
  name: string;
  description: string;
  args: T;
  handler: (db: any, args: z.infer<T>) => Promise<KitToolResult>;
}): ToolDefinition<T> {
  return config;
}
