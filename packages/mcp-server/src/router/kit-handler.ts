import type {
  KitRegistryItem,
  KitToolResult,
  McpToolDefinition,
  KitToolInput,
  UserKitDbItem,
} from "../framework/types";
import { dispatchToolCall } from "./tool-dispatcher";

/**
 * The single static tool definition returned by tools/list.
 */
export const KIT_TOOL_DEFINITION: McpToolDefinition = {
  name: "kit",
  description: [
    "KitStack — persistent tool kits for AI. Works like a CLI:",
    "",
    "  kit()                    → list available kits",
    "  kit(id)                  → show actions in a kit",
    "  kit(id, cmd)             → describe an action's parameters",
    "  kit(id, cmd, params)     → run an action",
    "",
    "Start with kit() to see what's installed.",
  ].join("\n"),
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "Kit ID, e.g. 'crm'" },
      cmd: { type: "string", description: "Action name, e.g. 'add_contact'" },
      params: { type: "object", description: "Action parameters" },
    },
  },
};

/**
 * Route a kit() call based on which params are present.
 */
export async function handleKitCall(
  input: KitToolInput,
  userId: string,
  getAllTools: () => Promise<KitRegistryItem[]>,
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>,
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>
): Promise<KitToolResult> {
  const { id, cmd, params } = input;

  // kit() → list kits
  if (!id) {
    return handleListKits(userId, getAllTools, getUserKitDbs);
  }

  const allTools = await getAllTools();
  const [userDbs] = await Promise.all([getUserKitDbs(userId)]);
  const activatedKitIds = new Set(userDbs.map((db) => db.kitId));

  if (!activatedKitIds.has(id)) {
    return {
      content: [{ type: "text", text: `Kit "${id}" is not activated. Run kit() to see available kits.` }],
      isError: true,
    };
  }

  const kitTools = allTools.filter(
    (t) => t.kitId === id && !t.toolName.startsWith("kitstack_")
  );

  if (kitTools.length === 0) {
    return {
      content: [{ type: "text", text: `Kit "${id}" has no tools registered.` }],
      isError: true,
    };
  }

  // kit(id) → discover
  if (!cmd) {
    return handleDiscover(id, kitTools);
  }

  // kit(id, cmd) → describe
  if (!params) {
    return handleDescribe(id, cmd, kitTools);
  }

  // kit(id, cmd, params) → run
  return handleRun(id, cmd, params, userId, allTools, invokeKitLambda);
}

// --- List Kits ---

async function handleListKits(
  userId: string,
  getAllTools: () => Promise<KitRegistryItem[]>,
  getUserKitDbs: (userId: string) => Promise<UserKitDbItem[]>
): Promise<KitToolResult> {
  const [allTools, userDbs] = await Promise.all([
    getAllTools(),
    getUserKitDbs(userId),
  ]);

  const activatedKitIds = new Set(userDbs.map((db) => db.kitId));

  // Group tools by kit, only for activated kits
  const kits = new Map<string, { name: string; description: string; actionCount: number }>();
  for (const tool of allTools) {
    if (!activatedKitIds.has(tool.kitId)) continue;
    if (tool.toolName.startsWith("kitstack_")) continue;

    const existing = kits.get(tool.kitId);
    if (existing) {
      existing.actionCount++;
    } else {
      kits.set(tool.kitId, {
        name: tool.kitName,
        description: tool.kitDescription || tool.kitName,
        actionCount: 1,
      });
    }
  }

  if (kits.size === 0) {
    return {
      content: [{
        type: "text",
        text: "No kits activated. Visit kitstack.co/dashboard to activate kits.",
      }],
    };
  }

  let text = `## Your Kits\n\n`;
  text += "| ID | Name | Description | Actions |\n";
  text += "|-----|------|-------------|--------:|\n";
  for (const [kitId, kit] of kits) {
    text += `| \`${kitId}\` | ${kit.name} | ${kit.description} | ${kit.actionCount} |\n`;
  }
  text += `\n**Next:** \`kit(id="<kit-id>")\` to see a kit's actions.`;

  return { content: [{ type: "text", text }] };
}

// --- Discover ---

function handleDiscover(
  kitId: string,
  kitTools: KitRegistryItem[]
): KitToolResult {
  const kit = kitTools[0];
  let text = `## ${kit.kitName}\n\n`;
  if (kit.kitDescription) {
    text += `${kit.kitDescription}\n\n`;
  }

  text += "### Actions\n\n";
  text += "| Action | Description |\n";
  text += "|--------|-------------|\n";
  for (const tool of kitTools) {
    const schema = JSON.parse(tool.inputSchema);
    const hasRequired = schema.required && schema.required.length > 0;
    text += `| \`${tool.toolName}\` | ${tool.toolDescription} |\n`;
  }

  text += "\n**Run directly:** `kit(id=\"" + kitId + "\", cmd=\"<action>\", params={...})`\n";
  text += "**Describe first:** `kit(id=\"" + kitId + "\", cmd=\"<action>\")` to see parameter schema";

  return { content: [{ type: "text", text }] };
}

// --- Describe ---

function handleDescribe(
  kitId: string,
  cmd: string,
  kitTools: KitRegistryItem[]
): KitToolResult {
  const tool = kitTools.find((t) => t.toolName === cmd);
  if (!tool) {
    const available = kitTools.map((t) => t.toolName).join(", ");
    return {
      content: [{ type: "text", text: `Unknown action "${cmd}". Available: ${available}` }],
      isError: true,
    };
  }

  let text = `## ${tool.toolName}\n\n`;
  text += `${tool.toolDescription}\n\n`;
  text += "### Parameters\n\n";
  text += "```json\n";
  text += JSON.stringify(JSON.parse(tool.inputSchema), null, 2);
  text += "\n```\n\n";
  text += `**Run:** \`kit(id="${kitId}", cmd="${tool.toolName}", params={...})\``;

  return { content: [{ type: "text", text }] };
}

// --- Run ---

async function handleRun(
  kitId: string,
  cmd: string,
  params: Record<string, unknown>,
  userId: string,
  allTools: KitRegistryItem[],
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>
): Promise<KitToolResult> {
  return dispatchToolCall(
    cmd,
    params,
    userId,
    async () => allTools,
    invokeKitLambda
  );
}
