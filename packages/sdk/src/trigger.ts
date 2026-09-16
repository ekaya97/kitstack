import type { KitToolResult, ChannelContext, SessionContext, RequestIdentity } from "./types";
import {
  createDispatchEnvelope,
  dispatch,
  type DispatchEnvelope,
  type DispatchResult,
} from "./server/dispatch";
import { kit } from "./result";

export type TriggerKind = "http" | "webhook" | "schedule" | "stream";
export type TriggerIdentityType = "user" | "service" | "delegated";

/** The fixed identity a trigger uses; callers cannot replace it at ingress. */
export interface TriggerIdentity {
  readonly type: TriggerIdentityType;
  readonly principal: string;
  readonly actor?: string;
  readonly delegation?: string | Readonly<Record<string, unknown>>;
}

export interface TriggerVerificationRequest<TPayload = unknown> {
  readonly kitId: string;
  readonly triggerId: string;
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly payload: TPayload;
}

export interface TriggerContext {
  readonly envelope: DispatchEnvelope;
  readonly signal?: AbortSignal;
}

/** Transport-independent trigger declaration. Business logic belongs in the handler. */
export interface TriggerDefinition<TPayload = unknown, TResult = unknown> {
  readonly id: string;
  readonly kind: TriggerKind;
  readonly identity: TriggerIdentity;
  readonly kits: readonly string[];
  readonly channel?: ChannelContext;
  readonly verify?: (
    request: TriggerVerificationRequest<TPayload>,
  ) => boolean | Promise<boolean>;
  readonly handler: (context: TriggerContext, payload: TPayload) => TResult | Promise<TResult>;
}

export interface TriggerInvocation<TPayload = unknown> {
  readonly kitId: string;
  readonly payload: TPayload;
  readonly method?: string;
  readonly path?: string;
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly channel?: ChannelContext;
  readonly session?: SessionContext;
  readonly signal?: AbortSignal;
}

export interface TriggerAuditEvent {
  readonly triggerId: string;
  readonly kitId: string;
  readonly channel: ChannelContext;
  readonly outcome: "success" | "denied" | "error";
  readonly reason?: string;
}

export interface TriggerDispatchOptions {
  /** Required seam: an accepted or rejected trigger must be observable. */
  readonly audit: (event: TriggerAuditEvent) => void | Promise<void>;
}

export interface TriggerInvocationResult<TResult> {
  readonly result: DispatchResult;
  readonly value?: TResult;
  readonly envelope: DispatchEnvelope;
}

/** Validate and freeze a trigger declaration at kit composition time. */
export function defineTrigger<TPayload = unknown, TResult = unknown>(
  definition: TriggerDefinition<TPayload, TResult>,
): TriggerDefinition<TPayload, TResult> {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("defineTrigger: a trigger definition is required");
  }
  if (!nonEmpty(definition.id)) throw new TypeError("defineTrigger: id must be a non-empty string");
  if (!["http", "webhook", "schedule", "stream"].includes(definition.kind)) {
    throw new TypeError(`defineTrigger: unsupported kind "${String(definition.kind)}"`);
  }
  if (!definition.identity || !nonEmpty(definition.identity.principal)) {
    throw new TypeError("defineTrigger: identity.principal must be a non-empty string");
  }
  if (!definition.identity.type || !["user", "service", "delegated"].includes(definition.identity.type)) {
    throw new TypeError("defineTrigger: identity.type must be user, service, or delegated");
  }
  if (!Array.isArray(definition.kits) || definition.kits.length === 0 || definition.kits.some((kitId) => !nonEmpty(kitId))) {
    throw new TypeError("defineTrigger: kits must contain at least one non-empty kit id");
  }
  if (typeof definition.verify !== "function" && definition.kind === "webhook") {
    throw new TypeError("defineTrigger: webhook triggers require verify");
  }
  if (typeof definition.handler !== "function") throw new TypeError("defineTrigger: handler must be a function");

  return Object.freeze({
    ...definition,
    kits: Object.freeze([...definition.kits]),
    channel: definition.channel ? Object.freeze({ ...definition.channel }) : undefined,
  });
}

/**
 * Run a trigger through the shared dispatch pipeline. The caller's identity is
 * never trusted: the declaration supplies principal, actor, and delegation.
 */
export async function dispatchTrigger<TPayload, TResult>(
  trigger: TriggerDefinition<TPayload, TResult>,
  invocation: TriggerInvocation<TPayload>,
  options: TriggerDispatchOptions,
): Promise<TriggerInvocationResult<TResult>> {
  const channel = invocation.channel ?? trigger.channel ?? { kind: trigger.kind, id: trigger.id };
  const payload = invocation.payload;
  const args = isRecord(payload) ? payload : { payload };
  let value: TResult | undefined;
  const envelope = createDispatchEnvelope({
    kitId: invocation.kitId,
    command: trigger.id,
    args,
    principal: trigger.identity.principal,
    context: {
      actor: trigger.identity.actor ?? trigger.identity.principal,
      ...(trigger.identity.delegation ? { delegation: trigger.identity.delegation } : {}),
      channel,
      ...(invocation.session ? { session: invocation.session } : {}),
    },
  });

  const result = await dispatch(envelope, {
    resolve: async (request) => {
      if (!trigger.kits.includes(request.kitId)) {
        return {
          error: {
            code: "policy_denied",
            message: `Trigger "${trigger.id}" is not allowed for kit "${request.kitId}".`,
          },
        };
      }
      return {
        target: {
          kitId: request.kitId,
          command: trigger.id,
          validate: () => ({ success: true, data: args }),
        },
      };
    },
    checkPolicy: async () => {
      if (!trigger.verify) return true;
      const verified = await trigger.verify({
        kitId: invocation.kitId,
        triggerId: trigger.id,
        method: invocation.method ?? "POST",
        path: invocation.path ?? `/t/${invocation.kitId}/${trigger.id}`,
        headers: invocation.headers ?? {},
        payload,
      });
      return verified ? true : { allowed: false, reason: "Trigger verification failed." };
    },
    invoke: async (request, _target, _args, context) => {
      value = await trigger.handler({ envelope: request, signal: invocation.signal }, payload);
      return isKitToolResult(value) ? value : kit.json(value);
    },
    onComplete: async (request, completed) => {
      await options.audit({
        triggerId: trigger.id,
        kitId: request.kitId,
        channel: request.channel,
        outcome: completed.errorCode === "missing_grant" || completed.errorCode === "policy_denied"
          ? "denied"
          : completed.isError
            ? "error"
            : "success",
        ...(completed.isError ? { reason: textOf(completed) } : {}),
      });
    },
  });

  return { result, ...(value === undefined ? {} : { value }), envelope };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKitToolResult(value: unknown): value is KitToolResult {
  return isRecord(value) && Array.isArray(value.content);
}

function textOf(result: DispatchResult): string {
  const block = result.content[0];
  return block?.type === "text" ? block.text : result.errorCode ?? "trigger failed";
}
