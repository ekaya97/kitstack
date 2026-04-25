import type { z } from "zod";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { ToolDefinition, KitToolResult, KitContext } from "./types";

export function defineTool<T extends z.ZodType>(config: {
  name: string;
  description: string;
  args: T;
  handler: (db: LibSQLDatabase, args: z.infer<T>, ctx: KitContext) => Promise<KitToolResult>;
}): ToolDefinition<T> {
  return config;
}
