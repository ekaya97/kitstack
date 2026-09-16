import type {
  AuthzRequirement,
  ChannelContext,
  KitContext,
  KitToolResult,
  RequestIdentity,
  SessionContext,
} from "../types";

/** Stable error categories exposed by every dispatch transport. */
export type DispatchErrorCode =
  | "unknown_kit"
  | "unknown_tool"
  | "invalid_arguments"
  | "missing_grant"
  | "policy_denied"
  | "provider_failure";

/** Channel-neutral request envelope used by local and deployed runtimes. */
export interface DispatchEnvelope {
  kitId: string;
  command: string;
  args: Record<string, unknown>;
  identity: RequestIdentity;
  actor: string;
  delegation?: string | Readonly<Record<string, unknown>>;
  channel: ChannelContext;
  session: SessionContext;
}

/** Optional request fields transports add when creating an envelope. */
export interface DispatchRequestContext {
  actor?: string;
  delegation?: string | Readonly<Record<string, unknown>>;
  channel?: ChannelContext;
  session?: SessionContext;
}

export interface DispatchValidationSuccess {
  success: true;
  data: Record<string, unknown>;
}

export interface DispatchValidationFailure {
  success: false;
  message: string;
}

export type DispatchValidation =
  | DispatchValidationSuccess
  | DispatchValidationFailure;

/** The resolved command-independent portion of a dispatch target. */
export interface DispatchTarget {
  kitId: string;
  command: string;
  validate?: (args: Record<string, unknown>) => DispatchValidation;
  authorize?: (args: Record<string, unknown>, ctx: KitContext) => AuthzRequirement[];
  mode?: "assist" | "act";
}

export interface DispatchResolution {
  target?: DispatchTarget;
  error?: { code: DispatchErrorCode; message: string };
}

export interface DispatchDecision {
  allowed: boolean;
  reason?: string;
}

export interface DispatchDependencies {
  /** Resolve the command before any policy or provider work is performed. */
  resolve: (envelope: DispatchEnvelope) => Promise<DispatchResolution>;
  /** Build the request-scoped SDK context for in-process execution. */
  createContext?: (
    envelope: DispatchEnvelope,
    args: Record<string, unknown>,
  ) => KitContext;
  /** Check grants after command resolution and argument validation. */
  checkGrant?: (
    envelope: DispatchEnvelope,
    requirements: AuthzRequirement[],
    ctx?: KitContext,
  ) => Promise<boolean | DispatchDecision>;
  /** Apply policy and mode gates before invoking an external provider. */
  checkPolicy?: (
    envelope: DispatchEnvelope,
    target: DispatchTarget,
    args: Record<string, unknown>,
    ctx?: KitContext,
  ) => Promise<boolean | DispatchDecision>;
  /** Invoke the resolved command. Exceptions are normalized to provider_failure. */
  invoke: (
    envelope: DispatchEnvelope,
    target: DispatchTarget,
    args: Record<string, unknown>,
    ctx?: KitContext,
  ) => Promise<KitToolResult>;
  onComplete?: (
    envelope: DispatchEnvelope,
    result: DispatchResult,
    durationMs: number,
  ) => void | Promise<void>;
}

/** Kit result with a machine-readable stable dispatch error when applicable. */
export type DispatchResult = KitToolResult & { errorCode?: DispatchErrorCode };

/**
 * Shared dispatch pipeline for every channel:
 * resolve -> identity -> grant -> policy/mode -> invoke -> telemetry/audit.
 */
export async function dispatch(
  envelope: DispatchEnvelope,
  dependencies: DispatchDependencies,
): Promise<DispatchResult> {
  const startedAt = Date.now();
  let result: DispatchResult;

  try {
    if (!envelope.identity.principal || !envelope.actor) {
      result = dispatchError(
        "policy_denied",
        "A principal and actor are required for dispatch.",
      );
    } else {
      const resolution = await dependencies.resolve(envelope);
      if (resolution.error) {
        result = dispatchError(resolution.error.code, resolution.error.message);
      } else if (!resolution.target) {
        result = dispatchError(
          "unknown_tool",
          `Unknown tool: "${envelope.command}"`,
        );
      } else {
        const target = resolution.target;
        const validation = target.validate?.(envelope.args);
        if (validation && !validation.success) {
          result = dispatchError("invalid_arguments", validation.message);
        } else {
          const args = validation?.data ?? envelope.args;
          const ctx = dependencies.createContext?.(envelope, args);
          const requirements = target.authorize?.(args, ctx as KitContext) ?? [];

          const grantDecision = await evaluateGrant(
            dependencies.checkGrant,
            envelope,
            requirements,
            ctx,
          );
          if (!grantDecision.allowed) {
            result = dispatchError(
              "missing_grant",
              grantDecision.reason ?? "The requested kit grant is missing.",
            );
          } else {
            const policyDecision = await evaluatePolicy(
              dependencies.checkPolicy,
              envelope,
              target,
              args,
              ctx,
            );
            if (!policyDecision.allowed) {
              result = dispatchError(
                "policy_denied",
                policyDecision.reason ?? "The request was denied by policy.",
              );
            } else {
              try {
                result = await dependencies.invoke(envelope, target, args, ctx);
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                result = dispatchError("provider_failure", message);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result = dispatchError("provider_failure", message);
  }

  try {
    await dependencies.onComplete?.(envelope, result, Date.now() - startedAt);
  } catch {
    // Observability must not alter the outcome of the capability call.
  }
  return result;
}

export function createDispatchEnvelope(input: {
  kitId: string;
  command: string;
  args?: Record<string, unknown>;
  principal: string;
  context?: DispatchRequestContext;
  defaultChannel?: ChannelContext;
}): DispatchEnvelope {
  const actor = input.context?.actor ?? input.principal;
  const delegation = input.context?.delegation;
  return {
    kitId: input.kitId,
    command: input.command,
    args: input.args ?? {},
    identity: {
      principal: input.principal,
      actor,
      ...(delegation ? { delegation } : {}),
    },
    actor,
    ...(delegation ? { delegation } : {}),
    channel: input.context?.channel ?? input.defaultChannel ?? { kind: "internal" },
    session: input.context?.session ?? {
      id: crypto.randomUUID(),
      traceId: crypto.randomUUID(),
    },
  };
}

function dispatchError(code: DispatchErrorCode, message: string): DispatchResult {
  return {
    errorCode: code,
    isError: true,
    content: [{ type: "text", text: `[${code}] ${message}` }],
  };
}

async function evaluateGrant(
  checkGrant: DispatchDependencies["checkGrant"],
  envelope: DispatchEnvelope,
  requirements: AuthzRequirement[],
  ctx?: KitContext,
): Promise<DispatchDecision> {
  if (!checkGrant) return { allowed: true };
  try {
    return normalizeDecision(await checkGrant(envelope, requirements, ctx));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { allowed: false, reason: `Grant provider failed: ${message}` };
  }
}

async function evaluatePolicy(
  checkPolicy: DispatchDependencies["checkPolicy"],
  envelope: DispatchEnvelope,
  target: DispatchTarget,
  args: Record<string, unknown>,
  ctx?: KitContext,
): Promise<DispatchDecision> {
  if (!checkPolicy) return { allowed: true };
  try {
    return normalizeDecision(await checkPolicy(envelope, target, args, ctx));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { allowed: false, reason: `Policy provider failed: ${message}` };
  }
}

function normalizeDecision(value: boolean | DispatchDecision): DispatchDecision {
  return typeof value === "boolean" ? { allowed: value } : value;
}
