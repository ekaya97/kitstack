import type { z } from "zod";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { ToolBase, ToolDefinition, KitToolResult, KitContext } from "./types";
import { kit } from "./result";

/**
 * The typed shape returned by defineTool when load() is provided.
 * This is NOT stored in KitDefinition — it's the call-site return type
 * that gives callers typed access to .load().
 */
export interface TypedToolWithLoad<T extends z.ZodType, TData> extends ToolBase {
  load: (db: LibSQLDatabase, args: z.infer<T>, ctx: KitContext) => Promise<TData>;
  handler: (db: LibSQLDatabase, args: z.infer<T>, ctx: KitContext) => Promise<KitToolResult>;
}

// Overload 1: with load()
export function defineTool<T extends z.ZodType, TData>(config: {
  name: string;
  description: string;
  args: T;
  load: (db: LibSQLDatabase, args: z.infer<T>, ctx: KitContext) => Promise<TData>;
  handler?: (db: LibSQLDatabase, args: z.infer<T>, ctx: KitContext) => Promise<KitToolResult>;
}): TypedToolWithLoad<T, TData>;

// Overload 2: handler only (no load)
export function defineTool<T extends z.ZodType>(config: {
  name: string;
  description: string;
  args: T;
  handler: (db: LibSQLDatabase, args: z.infer<T>, ctx: KitContext) => Promise<KitToolResult>;
}): ToolDefinition;

// Implementation
export function defineTool(config: any): any {
  if (config.load && !config.handler) {
    config.handler = async (db: LibSQLDatabase, args: any, ctx: KitContext) => {
      const data = await config.load(db, args, ctx);
      return kit.json(data);
    };
  }
  return config;
}
