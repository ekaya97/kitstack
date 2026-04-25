/**
 * Lambda handler for the CRM kit.
 * Bridges the SDK-pattern tools (db, args, ctx) to the existing
 * KitToolInvocation format from the McpRouter.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { KitContext, KitToolResult } from "./src/sdk";
import kit from "./kit.config";

interface KitToolInvocation {
  toolName: string;
  args: Record<string, unknown>;
  userId: string;
  kitId: string;
  dbUrl: string;
  dbToken: string;
}

const toolMap = new Map(kit.tools.map((t) => [t.name, t]));

export const handler = async (event: KitToolInvocation): Promise<KitToolResult> => {
  // Instruction meta-tool
  if (event.toolName === `kitstack_${kit.id}_instructions`) {
    return { content: [{ type: "text", text: kit.instructions }] };
  }

  const tool = toolMap.get(event.toolName);
  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${event.toolName}` }],
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

  const client = createClient({ url: event.dbUrl, authToken: event.dbToken });
  const db = drizzle(client);
  const ctx: KitContext = { userId: event.userId, kitId: event.kitId };

  return await tool.handler(db, parsed.data, ctx);
};
