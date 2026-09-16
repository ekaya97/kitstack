import type { KitRegistryItem, KitToolInvocation, KitToolResult } from "./types";
import { createDispatchEnvelope, dispatch } from "../../../sdk/src/server/dispatch";
import type { DispatchTarget } from "../../../sdk/src/server/dispatch";
import { getUserKitDb } from "../db/dynamo";
import {
  authorizeToolInvocation,
  interactiveIdentity,
  mcpCheckTuple,
} from "./authz";
import { audit } from "./audit";
import { log } from "./logger";
import { getKitFunctionId, getKitAuthzSlug } from "./kit-resources";
import { getOAuthItem, putOAuthItem } from "./oauth-store";
import type { PlatformAdapterRequestContext } from "./platform-adapter";

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
  invokeKitLambda: (arn: string, payload: unknown) => Promise<unknown>,
  requestContext?: PlatformAdapterRequestContext,
): Promise<KitToolResult> {
  // Resolve the registry once; all later stages run through the SDK dispatch
  // core so local and deployed runtimes share the same ordering and errors.
  const allTools = await getAllTools();
  const tool = allTools.find((t) => t.toolName === toolName);
  const identity = requestContext?.identity ?? interactiveIdentity(userId);
  const kitId = tool?.kitId ?? "unknown";
  const requestId = requestContext?.requestId?.trim() || `mcp-${crypto.randomUUID()}`;
  const sessionId = requestContext?.sessionId?.trim() || requestId;
  const traceId = requestContext?.traceId?.trim() || requestId;
  const envelope = createDispatchEnvelope({
    kitId,
    command: toolName,
    args,
    principal: identity.principal,
    context: {
      actor: identity.actor,
      ...(identity.delegation ? { delegation: identity.delegation } : {}),
      channel: { kind: "mcp", id: requestId },
      session: { id: sessionId, traceId, ...(requestContext?.parentId ? { parentId: requestContext.parentId } : {}) },
    },
  });
  const target: DispatchTarget | undefined = tool
    ? { kitId: tool.kitId, command: toolName, mode: tool.mode ?? "assist" }
    : undefined;

  return dispatch(envelope, {
    resolve: async () => {
      if (!target) {
        log.warn("Unknown tool requested", { userId, toolName });
        audit({ action: "tool.call.error", userId, toolName, detail: "unknown tool" });
        return { error: { code: "unknown_tool", message: `Unknown tool: ${toolName}` } };
      }
      return { target };
    },
    checkGrant: async () => {
      if (!tool) return { allowed: false, reason: "Unknown tool" };
      const authorization = await authorizeToolInvocation(
        { identity, mode: tool.mode ?? "assist", kitSlug: getKitAuthzSlug(tool.kitId) },
        mcpCheckTuple,
      );
      if (authorization.allowed) return { allowed: true };
      log.warn("Kit not authorized for user", { userId, toolName, kitId: tool.kitId, reason: authorization.reason });
      audit({ action: "tool.call.error", userId, toolName, kitId: tool.kitId, detail: "kit not authorized" });
      return { allowed: false, reason: `Kit "${tool.kitName}" is not authorized for this operation (not activated).` };
    },
    checkPolicy: async () => {
      if (!tool) return { allowed: false, reason: "Unknown tool" };
      if (!(await checkCircuitBreaker(tool.kitId))) {
        log.warn("Circuit breaker open", { userId, toolName, kitId: tool.kitId });
        return { allowed: false, reason: `Kit "${tool.kitName}" is temporarily disabled due to repeated errors. Try again in a few minutes.` };
      }
      if (!(await checkDailyCap(identity.principal, tool.kitId))) {
        log.warn("Daily invocation cap reached", { userId, toolName, kitId: tool.kitId });
        return { allowed: false, reason: `Daily usage limit reached for "${tool.kitName}" (${DAILY_INVOCATION_CAP} calls/day). Resets at midnight UTC.` };
      }
      return { allowed: true };
    },
    invoke: async () => {
      if (!tool) return { isError: true, content: [{ type: "text" as const, text: `Unknown tool: ${toolName}` }] };
      const userDb = await getUserKitDb(identity.principal, tool.kitId);
      if (!userDb) {
        log.warn("Kit DB not found for user", { userId, toolName, kitId: tool.kitId });
        audit({ action: "tool.call.error", userId, toolName, kitId: tool.kitId, detail: "kit db not provisioned" });
        return { isError: true, content: [{ type: "text" as const, text: `Kit "${tool.kitName}" database is not provisioned. Please re-activate it at kitstack.co/dashboard.` }] };
      }
      const functionId = getKitFunctionId(tool.kitId, allTools);
      if (!functionId) {
        log.error("No Lambda function for kit", { kitId: tool.kitId });
        return { isError: true, content: [{ type: "text" as const, text: `Kit "${tool.kitName}" is not configured.` }] };
      }
      const invocation: KitToolInvocation = {
        toolName,
        args,
        userId: identity.principal,
        kitId: tool.kitId,
        dbUrl: userDb.dbUrl,
        dbToken: userDb.dbToken,
        sessionId,
        traceId,
        ...(requestContext?.parentId ? { parentId: requestContext.parentId } : {}),
      };
      let result: KitToolResult;
      try {
        result = (await invokeKitLambda(functionId, invocation)) as KitToolResult;
      } catch (err: any) {
        log.error("Kit Lambda invocation failed", { kitId: tool.kitId, toolName, userId, functionId, error: err.message });
        audit({ action: "tool.call.error", userId, toolName, kitId: tool.kitId, detail: err.message });
        return { isError: true, content: [{ type: "text" as const, text: `Kit invocation failed: ${err.message}` }], errorCode: "provider_failure" as const };
      }
      recordCircuitBreakerResult(tool.kitId, !!result.isError).catch(() => {});
      incrementDailyCap(identity.principal, tool.kitId).catch(() => {});
      return result;
    },
    onComplete: async (_request, result, durationMs) => {
      if (!tool || result.errorCode === "unknown_tool" || result.errorCode === "missing_grant") return;
      audit({
        action: result.isError ? "tool.call.error" : "tool.call",
        userId,
        toolName,
        kitId: tool.kitId,
        durationMs,
        ...(result.isError && result.content[0]?.type === "text" ? { detail: result.content[0].text } : {}),
      });
    },
  });
}
