/**
 * Lambda handler for the CRM kit.
 * Handles two invocation types:
 * - Tool: { toolName, args, userId, kitId, dbUrl, dbToken }
 * - Loader: { loaderSlug, userId, kitId, dbUrl, dbToken }
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { KitContext, KitToolResult } from "./src/sdk";
import kit from "./kit.config";

interface KitToolInvocation {
  toolName?: string;
  loaderSlug?: string;
  args?: Record<string, unknown>;
  userId: string;
  kitId: string;
  dbUrl: string;
  dbToken: string;
}

const toolMap = new Map(kit.tools.map((t) => [t.name, t]));
const viewMap = new Map((kit.views ?? []).map((v) => [v.slug, v]));

export const handler = async (event: KitToolInvocation): Promise<KitToolResult | unknown> => {
  const client = createClient({ url: event.dbUrl, authToken: event.dbToken });
  const db = drizzle(client);
  const ctx: KitContext = { userId: event.userId, kitId: event.kitId };

  // ── Loader invocation ──
  if (event.loaderSlug) {
    const view = viewMap.get(event.loaderSlug);
    if (!view) {
      return { error: `Unknown view: ${event.loaderSlug}` };
    }
    const data = await view.loader(db, ctx);
    return { data };
  }

  // ── Tool invocation ──
  const toolName = event.toolName;

  // Instruction meta-tool
  if (toolName === `kitstack_${kit.id}_instructions`) {
    return { content: [{ type: "text", text: kit.instructions }] };
  }

  const tool = toolMap.get(toolName!);
  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
      isError: true,
    };
  }

  const parsed = tool.args.safeParse(event.args);
  if (!parsed.success) {
    return {
      content: [
        {
          type: "text",
          text: `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
        },
      ],
      isError: true,
    };
  }

  return await tool.handler(db, parsed.data, ctx);
};
