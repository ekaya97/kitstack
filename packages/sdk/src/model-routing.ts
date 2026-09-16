import type { MetadataTelemetrySink } from "./telemetry";

export type ModelTaskClass = "conversation" | "extraction" | (string & {});

export interface DeclarativeModelPolicy {
  /** Hand-authored model by task class; this is the cold-start policy. */
  readonly models: Readonly<Record<string, string>>;
  /** Safe model used when a task class has no explicit entry. */
  readonly fallback?: string;
}

export interface ModelRouteContext {
  readonly orgId: string;
  readonly appId?: string | null;
  readonly sessionId?: string | null;
  readonly traceId?: string | null;
  readonly parentId?: string | null;
  readonly kitId?: string | null;
  readonly pluginId?: string | null;
}

export interface ModelRoute {
  readonly taskClass: string;
  readonly model: string;
  readonly reason: "declarative-task-class" | "declarative-fallback";
}

export interface DeclarativeModelRouterOptions {
  readonly policy: DeclarativeModelPolicy;
  readonly telemetry?: MetadataTelemetrySink;
  readonly now?: () => string;
  readonly createId?: () => string;
}

/** Resolve models deterministically and emit an explainable routing decision. */
export function createDeclarativeModelRouter(options: DeclarativeModelRouterOptions) {
  const entries = Object.entries(options.policy.models)
    .map(([taskClass, model]) => [taskClass.trim(), model.trim()] as const)
    .filter(([taskClass, model]) => taskClass.length > 0 && model.length > 0);
  const models = new Map(entries);
  const fallback = options.policy.fallback?.trim() || entries[0]?.[1];
  if (!fallback) throw new Error("Declarative model policy requires at least one model");
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? (() => crypto.randomUUID());

  return {
    async resolve(taskClass: ModelTaskClass, context: ModelRouteContext): Promise<ModelRoute> {
      const explicit = models.get(taskClass);
      const route: ModelRoute = {
        taskClass,
        model: explicit ?? fallback,
        reason: explicit ? "declarative-task-class" : "declarative-fallback",
      };
      await options.telemetry?.append({
        id: createId(),
        timestamp: now(),
        orgId: context.orgId,
        appId: context.appId,
        sessionId: context.sessionId,
        traceId: context.traceId,
        parentId: context.parentId,
        channel: "system",
        kitId: context.kitId,
        pluginId: context.pluginId ?? "model:declarative",
        type: "model.route",
        operation: "resolve",
        model: route.model,
        routingReason: route.reason,
        outcome: "success",
      });
      return route;
    },
  };
}
