import { describe, expect, it } from "vitest";
import { createNonVoiceFixtureAgent } from "./fixtures/non-voice-agent";

describe("defineAgent non-voice fixture", () => {
  it("runs a deterministic text/tool loop with correlated metadata-only events", async () => {
    const { agent, events, outputs } = createNonVoiceFixtureAgent();

    const result = await agent.run({
      sessionId: "fixture-session",
      traceId: "fixture-trace",
      parentId: "fixture-parent",
    });

    expect(result).toMatchObject({
      status: "completed",
      sessionId: "fixture-session",
      turns: 2,
      toolCalls: 1,
      outputs: 1,
    });
    expect(outputs).toEqual(["Acme is qualified."]);

    const turns = events.filter((event) => event.type === "turn_finished");
    const toolCalls = events.filter((event) => event.type === "tool_called");
    expect(turns).toHaveLength(2);
    expect(toolCalls).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      sessionId: "fixture-session",
      traceId: "fixture-trace",
      parentId: "fixture-parent",
      provider: "fake-provider",
      model: "fake-text-v1",
      requestTokens: 10,
      responseTokens: 4,
      costUsd: 0.000014,
      routingReason: "fixture-static-route",
      outcome: "tool_call",
    });
    expect(turns[1]).toMatchObject({
      sessionId: "fixture-session",
      traceId: "fixture-trace",
      provider: "fake-provider",
      model: "fake-text-v1",
      requestTokens: 15,
      responseTokens: 8,
      costUsd: 0.000023,
      outcome: "message",
    });
    expect(toolCalls[0]).toMatchObject({
      sessionId: "fixture-session",
      traceId: "fixture-trace",
      toolName: "lookup_account",
      provider: "fake-provider",
      model: "fake-text-v1",
      requestTokens: 10,
      responseTokens: 4,
      outcome: "completed",
    });

    for (const event of events) {
      expect(event).not.toHaveProperty("content");
      expect(event).not.toHaveProperty("prompt");
      expect(event).not.toHaveProperty("completion");
      expect(event).not.toHaveProperty("args");
      expect(event).not.toHaveProperty("result");
    }
  });
});
