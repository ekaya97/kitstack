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

export interface ToolDefinition<TArgs extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  args: TArgs;
  handler: (
    db: LibSQLDatabase,
    args: z.infer<TArgs>,
    ctx: KitContext
  ) => Promise<KitToolResult>;
}

// --- Loader ---

export type LoaderFn = (
  db: LibSQLDatabase,
  ctx: KitContext
) => Promise<unknown>;

export type LoaderData<T extends { loader: LoaderFn }> = Awaited<
  ReturnType<T["loader"]>
>;

// --- View Definition ---

export interface ViewDefinition<TLoader extends LoaderFn = LoaderFn> {
  slug: string;
  name: string;
  description: string;
  loader: TLoader;
  component: string;
  permissions?: {
    clipboardWrite?: boolean;
  };
}

// --- Kit Definition ---

export interface KitDefinition {
  id: string;
  name: string;
  description: string;
  schema: Record<string, unknown>;
  migrationSql: string;
  instructions: string;
  tools: ToolDefinition[];
  views?: ViewDefinition[];
}
