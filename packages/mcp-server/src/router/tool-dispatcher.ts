import type { KitRegistryItem, KitToolInvocation, KitToolResult } from "../framework/types";
import { getUserKitDb } from "../framework/dynamo";
import { audit } from "../framework/audit";

export async function dispatchToolCall(
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  getAllTools: () => Promise<KitRegistryItem[]>,
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const start = Date.now();

  // Find the tool in registry
  const allTools = await getAllTools();
  const tool = allTools.find((t) => t.toolName === toolName);

  if (!tool) {
    audit({ action: "tool.call.error", userId, toolName, detail: "unknown tool" });
    return {
      content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
      isError: true,
    };
  }

  // Look up user's database for this kit
  const userDb = await getUserKitDb(userId, tool.kitId);
  if (!userDb) {
    audit({ action: "tool.call.error", userId, toolName, kitId: tool.kitId, detail: "kit not activated" });
    return {
      content: [
        {
          type: "text",
          text: `Kit "${tool.kitName}" is not activated. Please activate it at kitstack.co/dashboard first.`,
        },
      ],
      isError: true,
    };
  }

  // Build the invocation payload
  const invocation: KitToolInvocation = {
    toolName,
    args,
    userId,
    kitId: tool.kitId,
    dbUrl: userDb.dbUrl,
    dbToken: userDb.dbToken,
  };

  // Invoke the kit Lambda
  const result = (await invokeKitLambda(tool.lambdaArn, invocation)) as KitToolResult;

  audit({
    action: result.isError ? "tool.call.error" : "tool.call",
    userId,
    toolName,
    kitId: tool.kitId,
    durationMs: Date.now() - start,
    ...(result.isError ? { detail: result.content[0]?.text } : {}),
  });

  return result;
}
