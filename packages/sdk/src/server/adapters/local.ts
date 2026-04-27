import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { KitDefinition, KitToolResult, KitContext, ToolDefinition } from "../../types";
import type { KitServerAdapter, ResolvedKit } from "../types";
import { zodToJsonSchema } from "../../runtime/zod-to-json-schema";
import { generateShell } from "../../shell-template";

export interface LocalAdapterOptions {
  /** The kit definition. */
  kit: KitDefinition;
  /** The database connection. */
  db: LibSQLDatabase;
  /** User ID for single-user mode. Default: "dev-user". */
  userId?: string;
  /** Pre-built shell HTML. If omitted, generated from shell-template. */
  shellHtml?: string;
  /** CDN URL for platform assets. */
  platformCdn?: string;
  /** CDN URL for kit assets. */
  kitCdn?: string;
  /** Dev asset base URL for relay mode. */
  devAssetBaseUrl?: string;
}

/**
 * Local adapter for single-kit, in-process execution.
 *
 * Used by:
 * - `kitstack dev` (dev server)
 * - `kitstack serve` (self-hosted)
 * - Tool Iterator skill (in-process testing)
 *
 * All tool handlers run directly against the provided database.
 * No network, no Lambda, no DynamoDB.
 */
export function localAdapter(options: LocalAdapterOptions): KitServerAdapter {
  const { kit, db } = options;
  const defaultUserId = options.userId ?? "dev-user";

  // Pre-compute maps
  const toolMap = new Map<string, ToolDefinition>(
    kit.tools.map((t) => [t.name, t])
  );
  const viewMap = new Map(
    (kit.views ?? []).map((v) => [v.slug, v])
  );

  // Pre-generate shell HTML
  const shellHtml =
    options.shellHtml ??
    (kit.views?.length
      ? generateShell({
          kitId: kit.id,
          platformCdn: options.platformCdn ?? "",
          kitCdn: options.kitCdn ?? "",
          views: (kit.views ?? []).map((v) => ({
            slug: v.slug,
            height: v.height,
          })),
        })
      : "");

  // Pre-compute resolved kit (doesn't change at runtime)
  const resolvedKit: ResolvedKit = {
    id: kit.id,
    name: kit.name,
    description: kit.description,
    triggers: kit.triggers ?? [],
    instructions: kit.instructions || null,
    tools: kit.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.args),
    })),
    views: (kit.views ?? []).map((v) => ({
      slug: v.slug,
      name: v.name,
      description: v.description,
    })),
  };

  function makeCtx(userId: string): KitContext {
    return { userId: userId || defaultUserId, kitId: kit.id };
  }

  return {
    async resolveUserKits() {
      // Single-kit local mode — always returns the one kit
      return [resolvedKit];
    },

    async executeTool(kitId, toolName, args, userId) {
      const tool = toolMap.get(toolName);
      if (!tool) {
        return {
          content: [{ type: "text", text: `Unknown tool: "${toolName}". Available: ${[...toolMap.keys()].join(", ")}` }],
          isError: true,
        };
      }

      const parsed = tool.args.safeParse(args);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", ");
        return {
          content: [{ type: "text", text: `Invalid arguments: ${issues}` }],
          isError: true,
        };
      }

      return tool.handler!(db, parsed.data, makeCtx(userId));
    },

    async executeLoader(kitId, viewSlug, userId) {
      const view = viewMap.get(viewSlug);
      if (!view) {
        throw new Error(`Unknown view: "${viewSlug}"`);
      }
      return view.loader(db, makeCtx(userId));
    },

    async getShellHtml() {
      return shellHtml;
    },
  };
}
