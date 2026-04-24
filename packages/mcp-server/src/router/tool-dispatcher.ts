import type { KitRegistryItem, KitToolInvocation, KitToolResult } from "../framework/types";
import { getUserKitDb } from "../framework/dynamo";
import { mcpCheckTuple } from "../framework/authz";
import { audit } from "../framework/audit";
import { log } from "../framework/logger";
import { Resource } from "sst";

// kitId (MCP internal) → kitSlug (user-facing, used in authz tuples)
const KIT_ID_TO_SLUG: Record<string, string> = {
  crm: "crm-kit",
  "expense-tax-prep": "expense-tax-prep-kit",
  "cold-outreach": "cold-outreach-kit",
  "meeting-action-tracker": "meeting-action-tracker-kit",
};

// kitId → SST Resource name for Lambda ARN resolution
const KIT_RESOURCE_MAP: Record<string, string> = {
  "meeting-action-tracker": "KitMeeting",
  crm: "KitCrm",
  "expense-tax-prep": "KitExpense",
  "cold-outreach": "KitOutreach",
};

function getKitFunctionId(kitId: string): string | null {
  const resourceName = KIT_RESOURCE_MAP[kitId];
  if (!resourceName) return null;
  const fn = (Resource as any)[resourceName];
  if (!fn) return null;
  // In production: fn.arn is set. In sst dev: fn.name is the function name.
  return fn.arn ?? fn.name ?? null;
}

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
  const kitSlug = KIT_ID_TO_SLUG[tool.kitId];
  if (kitSlug) {
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
  const functionId = getKitFunctionId(tool.kitId);
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
