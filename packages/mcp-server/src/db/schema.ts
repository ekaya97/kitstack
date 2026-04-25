import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

// Kit registry (tool definitions for MCP server)
export const kitRegistryTable = sqliteTable("kit_registry", {
  kitId: text("kit_id").notNull(),
  toolName: text("tool_name").notNull(),
  toolDescription: text("tool_description").notNull(),
  inputSchema: text("input_schema").notNull(),
  kitName: text("kit_name").notNull(),
  kitDescription: text("kit_description"),
}, (table) => [
  uniqueIndex("kit_registry_pk").on(table.kitId, table.toolName),
]);

// Kit view registry (view definitions for MCP Apps)
export const kitViewsTable = sqliteTable("kit_views", {
  kitId: text("kit_id").notNull(),
  viewSlug: text("view_slug").notNull(),
  viewName: text("view_name").notNull(),
  viewDescription: text("view_description").notNull(),
  height: integer("height").default(400),
  shellS3Key: text("shell_s3_key"),
}, (table) => [
  uniqueIndex("kit_views_pk").on(table.kitId, table.viewSlug),
]);
