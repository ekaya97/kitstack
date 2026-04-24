import type {
  KitRegistryItem,
  KitToolResult,
  McpToolDefinition,
  OnionToolInput,
} from "../framework/types";
import { dispatchToolCall } from "./tool-dispatcher";

/**
 * Build one MCP tool definition per kit for onion mode.
 * Groups registry items by kitId and creates a meta-tool for each.
 */
export function buildOnionTools(
  registryItems: KitRegistryItem[]
): McpToolDefinition[] {
  const kitsMap = new Map<string, { name: string; description: string }>();

  for (const item of registryItems) {
    if (!kitsMap.has(item.kitId)) {
      kitsMap.set(item.kitId, {
        name: item.kitName,
        description: item.kitDescription || item.kitName,
      });
    }
  }

  return Array.from(kitsMap.entries()).map(([kitId, kit]) => ({
    name: kitId,
    description: `${kit.name} — ${kit.description}. Use action='discover' to see available actions.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["discover", "describe", "execute"],
          description:
            "discover: list available actions and instructions. describe: get full parameter spec for an action. execute: run an action.",
        },
        name: {
          type: "string",
          description: "Action name (required for describe and execute)",
        },
        params: {
          type: "object",
          description: "Action parameters (required for execute)",
        },
      },
      required: ["action"],
    },
  }));
}

/**
 * Handle a tool call in onion mode.
 * Routes discover/describe/execute for a specific kit.
 */
export async function handleOnionCall(
  kitId: string,
  input: OnionToolInput,
  userId: string,
  getToolsForKit: () => Promise<KitRegistryItem[]>,
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>
): Promise<KitToolResult> {
  const allTools = await getToolsForKit();
  const kitTools = allTools.filter(
    (t) => t.kitId === kitId && !t.toolName.startsWith("kitstack_")
  );

  if (kitTools.length === 0) {
    return {
      content: [{ type: "text", text: `Kit "${kitId}" not found or has no tools.` }],
      isError: true,
    };
  }

  switch (input.action) {
    case "discover":
      return handleDiscover(kitId, kitTools, allTools);
    case "describe":
      return handleDescribe(kitId, input.name, kitTools);
    case "execute":
      return handleExecute(kitId, input, userId, allTools, invokeKitLambda);
    default:
      return {
        content: [{ type: "text", text: `Unknown action: ${input.action}. Use discover, describe, or execute.` }],
        isError: true,
      };
  }
}

function handleDiscover(
  kitId: string,
  kitTools: KitRegistryItem[],
  allTools: KitRegistryItem[]
): KitToolResult {
  // Find the instruction meta-tool for this kit
  const instructionTool = allTools.find(
    (t) => t.kitId === kitId && t.toolName.startsWith("kitstack_")
  );

  let text = "";

  if (instructionTool) {
    // The instruction text is delivered via the kit Lambda, but we can provide
    // kit name/description from the registry
    const kit = kitTools[0];
    text += `## ${kit.kitName}\n\n`;
    if (kit.kitDescription) {
      text += `${kit.kitDescription}\n\n`;
    }
  }

  text += "### Available actions\n\n";
  text += "| Action | Description |\n|--------|-------------|\n";
  for (const tool of kitTools) {
    text += `| \`${tool.toolName}\` | ${tool.toolDescription} |\n`;
  }

  text += "\n**Next steps:**\n";
  text += "- Use `action='describe'` with `name='<action>'` to get the full parameter spec\n";
  text += "- Use `action='execute'` with `name='<action>'` and `params={...}` to run it\n";
  text += "- For simple actions with no required params, you can skip describe and go straight to execute";

  return { content: [{ type: "text", text }] };
}

function handleDescribe(
  kitId: string,
  actionName: string | undefined,
  kitTools: KitRegistryItem[]
): KitToolResult {
  if (!actionName) {
    return {
      content: [{ type: "text", text: "Missing 'name' — specify which action to describe." }],
      isError: true,
    };
  }

  const tool = kitTools.find((t) => t.toolName === actionName);
  if (!tool) {
    const available = kitTools.map((t) => t.toolName).join(", ");
    return {
      content: [{ type: "text", text: `Unknown action '${actionName}'. Available: ${available}` }],
      isError: true,
    };
  }

  let text = `## ${tool.toolName}\n\n`;
  text += `${tool.toolDescription}\n\n`;
  text += `### Parameters\n\n`;
  text += "```json\n";
  text += JSON.stringify(JSON.parse(tool.inputSchema), null, 2);
  text += "\n```\n\n";
  text += `Call with \`action='execute'\`, \`name='${tool.toolName}'\`, \`params={...}\``;

  return { content: [{ type: "text", text }] };
}

async function handleExecute(
  kitId: string,
  input: OnionToolInput,
  userId: string,
  allTools: KitRegistryItem[],
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>
): Promise<KitToolResult> {
  if (!input.name) {
    return {
      content: [{ type: "text", text: "Missing 'name' — specify which action to execute." }],
      isError: true,
    };
  }

  // Delegate to the standard dispatcher with the actual tool name + params
  return dispatchToolCall(
    input.name,
    input.params || {},
    userId,
    async () => allTools,
    invokeKitLambda
  );
}
