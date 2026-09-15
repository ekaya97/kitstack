import { describe, expect, it, vi } from "vitest";
import { defineAgent } from "../src/define-agent";
import type { AgentInput, AgentLifecycleEvent, AgentMessage, AgentModelTurn, AgentSession } from "../src/types";

const input = (content: string): AgentInput => ({ content });

function makeAgent(overrides: Record<string, unknown> = {}) {
  const sourceInputs = (overrides.sourceInputs as AgentInput[] | undefined) ?? [input("hello"), null as any];
  let sourceIndex = 0;
  const outputs: string[] = [];
  const events: AgentLifecycleEvent[] = [];
  const modelTurns: AgentMessage[][] = [];
  const agent = defineAgent({
    id: "sales-agent",
    kitId: "sales",
    trigger: { id: "voice-call", identity: "sales-rep" },
    instructions: { version: "2026-09-15.1", content: "Sell helpfully and ask one question at a time." },
    tools: [],
    turnSource: {
      next: async () => sourceInputs[sourceIndex++] ?? null,
    },
    model: {
      turn: async ({ history }) => {
        modelTurns.push([...history]);
        return { type: "message", content: "Goodbye", terminal: true };
      },
    },
    output: { emit: async ({ content }) => void outputs.push(content) },
    hooks: { onEvent: async (event) => void events.push(event) },
    maxTurns: 5,
    maxDurationMs: 500,
    ...(overrides as any),
  });
  return { agent, outputs, events, modelTurns };
}

describe("defineAgent", () => {
  it("owns a multi-turn loop and preserves session context", async () => {
    const contexts: string[] = [];
    let index = 0;
    const { agent, outputs } = makeAgent({
      sourceInputs: [input("first"), input("second"), null],
      turnSource: { next: async ({ session }: { session: AgentSession; signal: AbortSignal }) => { contexts.push(session.context.user as string); return [input("first"), input("second"), null][index++] as any; } },
      model: { turn: async ({ input: current, session }: AgentModelTurn) => ({ type: "message", content: `${current?.content}:${session.id}`, terminal: false }) },
      maxTurns: 3,
    });
    const result = await agent.run({ sessionId: "session-1", context: { user: "Ada" } });
    expect(result.status).toBe("completed");
    expect(result.turns).toBe(2);
    expect(outputs).toEqual(["first:session-1", "second:session-1"]);
    expect(contexts).toEqual(["Ada", "Ada", "Ada"]);
  });

  it("executes a declared tool and continues with its result", async () => {
    const execute = vi.fn(async (args: unknown) => ({ ok: true, args }));
    let calls = 0;
    const histories: AgentMessage[][] = [];
    const { agent } = makeAgent({
      tools: [{ name: "lookup_lead", description: "Look up a sales lead", execute }],
      model: {
        turn: async ({ history }: AgentModelTurn) => {
          histories.push([...history]);
          return calls++ === 0
            ? { type: "tool_call", toolCallId: "call-1", name: "lookup_lead", args: { email: "ada@example.com" } }
            : { type: "message", content: "I found the lead", terminal: true };
        },
      },
    });
    const result = await agent.run({ sessionId: "s-tool" });
    expect(result.status).toBe("completed");
    expect(result.toolCalls).toBe(1);
    expect(execute).toHaveBeenCalledWith({ email: "ada@example.com" }, expect.anything(), expect.any(AbortSignal));
    expect(histories[1].at(-1)).toMatchObject({ role: "tool", name: "lookup_lead", result: { ok: true } });
  });

  it("rejects an undeclared tool without invoking any tool", async () => {
    const execute = vi.fn();
    const { agent, events } = makeAgent({
      tools: [{ name: "declared", description: "A declared tool", execute }],
      model: { turn: async () => ({ type: "tool_call", name: "missing", args: {} }) },
    });
    const result = await agent.run({ sessionId: "s-undeclared" });
    expect(result.status).toBe("failed");
    expect(result.error).toEqual({ code: "AGENT_UNDECLARED_TOOL", message: 'Model requested undeclared tool "missing"' });
    expect(execute).not.toHaveBeenCalled();
    expect(events).toContainEqual(expect.objectContaining({ type: "tool_called", outcome: "rejected" }));
  });

  it("returns cancellation when interrupted", async () => {
    const controller = new AbortController();
    const { agent } = makeAgent({
      turnSource: { next: async () => new Promise<AgentInput>(() => {}) },
    });
    const promise = agent.run({ sessionId: "s-cancel", signal: controller.signal });
    controller.abort();
    await expect(promise).resolves.toMatchObject({ status: "cancelled", error: { code: "AGENT_CANCELLED" } });
  });

  it("bounds the loop by timeout and max turns", async () => {
    const timeoutAgent = makeAgent({
      model: { turn: async ({ signal }: AgentModelTurn) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason))) },
      maxDurationMs: 10,
    }).agent;
    await expect(timeoutAgent.run({ sessionId: "s-timeout" })).resolves.toMatchObject({ status: "timed_out", error: { code: "AGENT_TIMEOUT" } });

    const maxTurnsAgent = makeAgent({
      model: { turn: async () => ({ type: "message", content: "again" }) },
      sourceInputs: [input("one"), null],
      maxTurns: 1,
    }).agent;
    await expect(maxTurnsAgent.run({ sessionId: "s-max" })).resolves.toMatchObject({ status: "completed", turns: 1 });
    const looping = makeAgent({
      model: { turn: async () => ({ type: "tool_call", name: "loop", args: {} }) },
      tools: [{ name: "loop", description: "Keep the loop going", execute: async () => null }],
      maxTurns: 2,
    }).agent;
    await expect(looping.run({ sessionId: "s-max-loop" })).resolves.toMatchObject({ status: "max_turns", turns: 2, error: { code: "AGENT_MAX_TURNS" } });
  });

  it("returns provider failures as structured errors", async () => {
    const { agent } = makeAgent({ model: { turn: async () => { throw new Error("provider unavailable"); } } });
    await expect(agent.run({ sessionId: "s-provider" })).resolves.toMatchObject({ status: "failed", error: { code: "AGENT_MODEL_ERROR", message: "provider unavailable" } });
  });

  it("isolates session context and only exposes metadata to lifecycle hooks", async () => {
    const seen: AgentLifecycleEvent[] = [];
    const { agent } = makeAgent({
      sourceInputs: [input("secret input"), null],
      hooks: { onEvent: async (event: AgentLifecycleEvent) => void seen.push(event) },
      model: { turn: async ({ session }: AgentModelTurn) => { session.context.count = ((session.context.count as number | undefined) ?? 0) + 1; return { type: "message", content: "secret completion", terminal: true }; } },
    });
    await agent.run({ sessionId: "s-one", context: { count: 0 } });
    await agent.run({ sessionId: "s-two", context: { count: 0 } });
    expect(seen.every((event) => !JSON.stringify(event).includes("secret"))).toBe(true);
    expect(seen.filter((event) => event.type === "run_finished")).toHaveLength(2);
  });
});
