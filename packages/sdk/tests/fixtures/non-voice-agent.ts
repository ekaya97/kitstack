import { defineAgent } from "../../src/define-agent";
import type { AgentInput, AgentLifecycleEvent, AgentModelTurn } from "../../src/types";

/**
 * A deterministic text agent used to prove defineAgent outside the voice path.
 * It has a fake model, a finite text source, and one local tool; no network or
 * external provider is contacted.
 */
export function createNonVoiceFixtureAgent() {
  const events: AgentLifecycleEvent[] = [];
  const outputs: string[] = [];
  const inputs: Array<AgentInput | null> = [{ content: "qualify Acme" }, null];
  let inputIndex = 0;
  let modelTurn = 0;

  const agent = defineAgent({
    id: "agent:fixture-enricher",
    kitId: "kit:fixture",
    trigger: { id: "trigger:text", identity: "fixture-user" },
    instructions: { version: "fixture@1", content: "Qualify the account and report the result." },
    turnSource: { next: async () => inputs[inputIndex++] ?? null },
    model: {
      provider: "fake-provider",
      model: "fake-text-v1",
      routingReason: "fixture-static-route",
      estimateCostUsd: ({ requestTokens, responseTokens }) => ((requestTokens ?? 0) + (responseTokens ?? 0)) * 0.000001,
      turn: async (_request: AgentModelTurn) => {
        modelTurn += 1;
        if (modelTurn === 1) {
          return {
            type: "tool_call" as const,
            toolCallId: "fixture-call-1",
            name: "lookup_account",
            args: { account: "Acme" },
            metadata: { requestTokens: 10, responseTokens: 4 },
          };
        }
        return {
          type: "message" as const,
          content: "Acme is qualified.",
          terminal: true,
          metadata: { requestTokens: 15, responseTokens: 8, costUsd: 0.000023 },
        };
      },
    },
    tools: [{
      name: "lookup_account",
      description: "Look up an account in the fixture source",
      execute: async () => ({ account: "Acme", qualified: true }),
    }],
    output: { emit: async ({ content }) => { outputs.push(content); } },
    hooks: { onEvent: async (event) => { events.push(event); } },
    maxTurns: 3,
    maxDurationMs: 1_000,
  });

  return { agent, events, outputs };
}
