import type { KitDefinition, KitToolInvocation, KitToolResult } from "./types";
import { createKitDbClient } from "./kit-db";

export function createKitHandler(kit: KitDefinition) {
  const toolMap = new Map(kit.tools.map((t) => [t.name, t]));

  return async (event: KitToolInvocation): Promise<KitToolResult> => {
    // Instruction meta-tool
    if (event.toolName === `kitstack_${kit.id}_instructions`) {
      return {
        content: [{ type: "text", text: kit.instructions }],
      };
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

    const db = createKitDbClient(event.dbUrl, event.dbToken);
    return tool.handler(db, parsed.data);
  };
}
