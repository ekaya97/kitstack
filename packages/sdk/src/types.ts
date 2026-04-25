import type { z } from "zod";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

// --- Context ---

export interface KitContext {
  userId: string;
  kitId: string;
  params?: Record<string, string>;
}

// --- Tool Result ---

export type KitToolContentBlock =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType: string; text: string } };

export interface KitToolResult {
  content: KitToolContentBlock[];
  isError?: boolean;
}

// --- Tool Definition ---

export interface ToolBase {
  name: string;
  description: string;
  args: z.ZodType;
}

/** Tool with load() (handler auto-generated if omitted) */
interface ToolWithLoad extends ToolBase {
  load: (db: LibSQLDatabase, args: any, ctx: KitContext) => Promise<any>;
  handler?: (db: LibSQLDatabase, args: any, ctx: KitContext) => Promise<KitToolResult>;
}

/** Tool with handler() only (no data layer) */
interface ToolHandlerOnly extends ToolBase {
  load?: undefined;
  handler: (db: LibSQLDatabase, args: any, ctx: KitContext) => Promise<KitToolResult>;
}

/** A tool must have at least load() or handler(). */
export type ToolDefinition = ToolWithLoad | ToolHandlerOnly;

// --- Loader ---

export type LoaderFn = (
  db: LibSQLDatabase,
  ctx: KitContext
) => Promise<unknown>;

export type LoaderData<T extends { loader: LoaderFn }> = Awaited<
  ReturnType<T["loader"]>
>;

/** Extract the return type from a loader or load function: `Infer<typeof loader>` */
export type Infer<T extends (...args: any[]) => any> = Awaited<ReturnType<T>>;

// --- View Definition ---

export interface ViewDefinition<TLoader extends LoaderFn = LoaderFn> {
  slug: string;
  name: string;
  description: string;
  loader: TLoader;
  component: React.ComponentType<{ data: Awaited<ReturnType<TLoader>> }>;
  height?: number;
  permissions?: {
    clipboardWrite?: boolean;
  };
}

// --- Kit Definition ---

export interface KitDefinition {
  id: string;
  version: string;
  name: string;
  description: string;
  schema: Record<string, unknown>;
  migrationSql: string;
  instructions: string;
  tools: ToolDefinition[];
  views?: ViewDefinition<any>[];
}
