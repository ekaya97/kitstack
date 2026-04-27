import type { KitRegistryItem, KitToolInvocation, KitToolResult } from "./types";
import { getUserKitDb } from "../db/dynamo";
import { mcpCheckTuple } from "./authz";
import { audit } from "./audit";
import { log } from "./logger";
import { getKitFunctionId, getKitAuthzSlug } from "./kit-resources";
import { getOAuthItem, putOAuthItem } from "./oauth-store";

// --- Circuit breaker + daily invocation cap ---

const CIRCUIT_BREAKER_THRESHOLD = 3;       // consecutive errors to trip
const CIRCUIT_BREAKER_COOLDOWN_MS = 300000; // 5 minutes
const DAILY_INVOCATION_CAP = 500;          // per user per kit per day

async function checkCircuitBreaker(kitId: string): Promise<boolean> {
  try {
    const item = await getOAuthItem(`CIRCUIT#${kitId}`, "STATE");
    if (!item) return true;
    const data = JSON.parse((item as any).data || "{}");
    if (data.disabledUntil && Date.now() < data.disabledUntil) {
      return false; // circuit is open — kit is disabled
    }
    return true;
  } catch {
    return true; // fail open — don't block on circuit breaker read failures
  }
}

async function recordCircuitBreakerResult(kitId: string, isError: boolean): Promise<void> {
  try {
    const item = await getOAuthItem(`CIRCUIT#${kitId}`, "STATE");
    const data = item ? JSON.parse((item as any).data || "{}") : { errorCount: 0 };

    if (isError) {
      data.errorCount = (data.errorCount || 0) + 1;
      if (data.errorCount >= CIRCUIT_BREAKER_THRESHOLD) {
        data.disabledUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
        log.warn("Circuit breaker tripped", { kitId, errorCount: data.errorCount });
      }
    } else {
      data.errorCount = 0;
      delete data.disabledUntil;
    }

    const ttl = Math.floor(Date.now() / 1000) + 600; // 10 min TTL
    await putOAuthItem({
      pk: `CIRCUIT#${kitId}`,
      sk: "STATE",
      data: JSON.stringify(data),
      ttl,
    });
  } catch (err: any) {
    log.error("Circuit breaker write failed", { kitId, error: err.message });
  }
}

async function checkDailyCap(userId: string, kitId: string): Promise<boolean> {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  try {
    const item = await getOAuthItem(`DAILY#${userId}#${kitId}`, date);
    if (!item) return true;
    const count = parseInt((item as any).data || "0", 10);
    return count < DAILY_INVOCATION_CAP;
  } catch {
    return false; // fail closed on read errors
  }
}

async function incrementDailyCap(userId: string, kitId: string): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  try {
    const item = await getOAuthItem(`DAILY#${userId}#${kitId}`, date);
    const count = item ? parseInt((item as any).data || "0", 10) + 1 : 1;
    const ttl = Math.floor(Date.now() / 1000) + 86400 * 2; // 2 day TTL
    await putOAuthItem({
      pk: `DAILY#${userId}#${kitId}`,
      sk: date,
      data: String(count),
      ttl,
    });
  } catch (err: any) {
    log.error("Daily cap increment failed", { userId, kitId, error: err.message });
  }
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

  // Circuit breaker: check if kit is temporarily disabled
  const circuitOk = await checkCircuitBreaker(tool.kitId);
  if (!circuitOk) {
    log.warn("Circuit breaker open", { userId, toolName, kitId: tool.kitId });
    return {
      content: [{ type: "text", text: `Kit "${tool.kitName}" is temporarily disabled due to repeated errors. Try again in a few minutes.` }],
      isError: true,
    };
  }

  // Daily invocation cap
  const withinCap = await checkDailyCap(userId, tool.kitId);
  if (!withinCap) {
    log.warn("Daily invocation cap reached", { userId, toolName, kitId: tool.kitId });
    return {
      content: [{ type: "text", text: `Daily usage limit reached for "${tool.kitName}" (${DAILY_INVOCATION_CAP} calls/day). Resets at midnight UTC.` }],
      isError: true,
    };
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

  // Track circuit breaker + daily cap (non-blocking)
  recordCircuitBreakerResult(tool.kitId, !!result.isError).catch(() => {});
  incrementDailyCap(userId, tool.kitId).catch(() => {});

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
