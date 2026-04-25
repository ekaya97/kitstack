import type { KitRegistryItem, KitToolInvocation, KitToolResult } from "../framework/types";
import { getUserKitDb } from "../framework/dynamo";
import { mcpCheckTuple } from "../framework/authz";
import { audit } from "../framework/audit";
import { log } from "../framework/logger";
import { getKitFunctionId, getKitAuthzSlug } from "./kit-resources";

export async function dispatchToolCall(
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  getAllTools: () => Promise<KitRegistryItem[]>,
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>
): Promise<KitToolResult> {
  const start = Date.now();

  // Find the tool in registry
  const allTools = await getAllTools();
  const tool = allTools.find((t) => t.toolName === toolName);

  if (!tool) {
    log.warn("Unknown tool requested", { userId, toolName });
    audit({ action: "tool.call.error", userId, toolName, detail: "unknown tool" });
    return {
      content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
      isError: true,
    };
  }

  // Authz: tuple check is authoritative — user must have activator relation
  const kitSlug = getKitAuthzSlug(tool.kitId);
  {
    const allowed = await mcpCheckTuple(userId, "activator", "kit", kitSlug);
    if (!allowed) {
      log.warn("Kit not authorized for user", { userId, toolName, kitId: tool.kitId });
      audit({ action: "tool.call.error", userId, toolName, kitId: tool.kitId, detail: "kit not authorized" });
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
  }

  // Fetch database credentials from DynamoDB
  const userDb = await getUserKitDb(userId, tool.kitId);
  if (!userDb) {
    log.warn("Kit DB not found for user", { userId, toolName, kitId: tool.kitId });
    audit({ action: "tool.call.error", userId, toolName, kitId: tool.kitId, detail: "kit db not provisioned" });
    return {
      content: [
        {
          type: "text",
          text: `Kit "${tool.kitName}" database is not provisioned. Please re-activate it at kitstack.co/dashboard.`,
        },
      ],
      isError: true,
    };
  }

  // Resolve Lambda function identifier from SST Resource at runtime
  const functionId = getKitFunctionId(tool.kitId, allTools);
  if (!functionId) {
    log.error("No Lambda function for kit", { kitId: tool.kitId });
    return {
      content: [{ type: "text", text: `Kit "${tool.kitName}" is not configured.` }],
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
  const result = (await invokeKitLambda(functionId, invocation)) as KitToolResult;

  audit({
    action: result.isError ? "tool.call.error" : "tool.call",
    userId,
    toolName,
    kitId: tool.kitId,
    durationMs: Date.now() - start,
    ...(result.isError && result.content[0]?.type === "text" ? { detail: result.content[0].text } : {}),
  });

  return result;
}
