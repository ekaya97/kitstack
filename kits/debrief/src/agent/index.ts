import {
  defineAgent,
  type AgentDefinition,
  type AgentInstructions,
  type AgentLifecycleHooks,
  type AgentModelConnector,
  type AgentOutputSink,
  type AgentToolDefinition,
  type AgentTurnSource,
} from "@kitstackco/sdk";
import { DEBRIEF_KIT_ID, type DebriefCapabilities } from "../contracts";

export const SALES_DEBRIEF_AGENT_ID = "agent:sales-debrief" as const;
export const SALES_DEBRIEF_TRIGGER_ID = "trigger:sales-debrief" as const;

export interface SalesAgentDependencies<TContext extends Record<string, unknown>> {
  /** Capabilities are resolved by the host and captured by tool/model adapters. */
  readonly capabilities: Pick<DebriefCapabilities, "memory" | "instructions" | "telemetry">;
  readonly instructions: AgentInstructions;
  readonly turnSource: AgentTurnSource<TContext>;
  readonly model: AgentModelConnector<TContext>;
  readonly output: AgentOutputSink<TContext>;
  readonly tools: readonly AgentToolDefinition<TContext>[];
  readonly hooks?: AgentLifecycleHooks;
  readonly maxTurns?: number;
  readonly maxDurationMs?: number;
}

/**
 * Create the bounded sales loop. The channel supplies turns and output while
 * host plugins supply the model, memory, instructions, and telemetry.
 */
export function createSalesAgent<TContext extends Record<string, unknown>>(
  dependencies: SalesAgentDependencies<TContext>,
): AgentDefinition<TContext> {
  // Keep capabilities in the dependency type even though the SDK agent only
  // needs the already-bound adapters. This makes the host/kit boundary explicit.
  void dependencies.capabilities;

  return defineAgent({
    id: SALES_DEBRIEF_AGENT_ID,
    kitId: DEBRIEF_KIT_ID,
    trigger: {
      id: SALES_DEBRIEF_TRIGGER_ID,
      identity: "sales-debrief",
    },
    instructions: dependencies.instructions,
    turnSource: dependencies.turnSource,
    model: dependencies.model,
    output: dependencies.output,
    tools: dependencies.tools,
    hooks: dependencies.hooks,
    maxTurns: dependencies.maxTurns ?? 30,
    maxDurationMs: dependencies.maxDurationMs ?? 10 * 60 * 1000,
  });
}
